import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/api/auth/[...nextauth]/route'
import config, { getDifyKey } from '@/config'

export async function GET(req: Request) {
  try {
    const DIFY_API_KEY = getDifyKey()
    const DIFY_API_BASE = (config.dify?.apiBase || 'https://api.dify.ai/v1').replace(/\/+$/, '')
    if (!DIFY_API_KEY) return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    // Derive tenant and user from session first, then headers as fallback
    const session = await getServerSession(authOptions)
    const tenant = req.headers.get('x-tenant-id') || session?.user?.tenantId || ''
    const user = session?.user?.id || req.headers.get('x-user-id')

    // For initial load we should fetch existing conversations and messages
    // instead of creating a new chat message. Call conversations list and then
    // fetch messages for the most recent conversation.

    const convsRes = await fetch(`${DIFY_API_BASE}/conversations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!convsRes.ok) {
      const text = await convsRes.text().catch(()=>"")
      console.error('Dify conversations error', convsRes.status, text)
      return new Response(JSON.stringify({ error: 'dify_error', detail: text }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }

    const convsJson = await convsRes.json().catch(()=>({ items: [] })) as unknown
    const items: unknown[] = (convsJson as { items?: unknown[]; conversations?: unknown[] }).items || (convsJson as { items?: unknown[]; conversations?: unknown[] }).conversations || []
    if (!items.length) {
      // no existing conversations — return an empty assistant welcome (client may show default)
      return new Response(JSON.stringify({ messages: [{ role: 'assistant', content: '' }] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Pick the most recent conversation (assume first or sort by updatedAt)
    let conv = items[0] as { id?: string; conversation_id?: string; conversationId?: string; updated_at?: string; updatedAt?: string }
    if (items.length > 1) {
      items.sort((a,b)=>{
        const aConv = a as { updated_at?: string; updatedAt?: string }
        const bConv = b as { updated_at?: string; updatedAt?: string }
        const ta = new Date(aConv.updated_at || aConv.updatedAt || 0).getTime()
        const tb = new Date(bConv.updated_at || bConv.updatedAt || 0).getTime()
        return tb - ta
      })
      conv = items[0] as { id?: string; conversation_id?: string; conversationId?: string; updated_at?: string; updatedAt?: string }
    }

    const convId = conv.id || conv.conversation_id || conv.conversationId
    if (!convId) {
      return new Response(JSON.stringify({ messages: [{ role: 'assistant', content: '' }] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Try conversation messages endpoint, fallback to messages query endpoint
    let msgsRes = await fetch(`${DIFY_API_BASE}/conversations/${convId}/messages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' }
    })

    if (!msgsRes.ok) {
      // fallback
      msgsRes = await fetch(`${DIFY_API_BASE}/messages?conversation_id=${encodeURIComponent(convId)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' }
      })
    }

    if (!msgsRes.ok) {
      const text = await msgsRes.text().catch(()=>"")
      console.error('Dify messages error', msgsRes.status, text)
      return new Response(JSON.stringify({ error: 'dify_error', detail: text }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }

    const msgsJson = await msgsRes.json().catch(()=>({ messages: [] })) as unknown
    const messagesRaw: unknown[] = (msgsJson as { items?: unknown[]; messages?: unknown[] }).items || (msgsJson as { items?: unknown[]; messages?: unknown[] }).messages || []

    // Map upstream messages to { role, content }
    const mapped = messagesRaw.map(m => {
      const msg = m as { role?: string; author?: { role?: string }; from?: string; content?: string; text?: string; body?: string; outputs?: { text?: string } }
      const role = msg.role || msg.author?.role || (msg.from === 'assistant' ? 'assistant' : 'user')
      const content = msg.content || msg.text || msg.body || (msg.outputs && msg.outputs.text) || ''
      return { role, content }
    }).filter(m=>m.content)

    return new Response(JSON.stringify({ messages: mapped }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Dify init proxy error', err)
    return new Response(JSON.stringify({ error: 'proxy_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

// runtime declaration removed — using default runtime
