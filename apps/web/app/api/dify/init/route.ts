import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/api/auth/[...nextauth]/route'
import config, { getDifyKey } from '@/config'

export async function GET(req: Request) {
  try {
    const DIFY_API_KEY = getDifyKey()
    const DIFY_API_BASE = (config.dify?.apiBase || 'https://api.dify.ai').replace(/\/+$/, '')
    if (!DIFY_API_KEY) return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    // Derive tenant and user from session first, then headers as fallback
    const session = await getServerSession(authOptions)
    const tenant = req.headers.get('x-tenant-id') || session?.user?.tenantId || ''
    const user = session?.user?.id || req.headers.get('x-user-id') || req.headers.get('x-user') || tenant || 'web-anonymous'

    // For initial load we should fetch existing conversations and messages
    // instead of creating a new chat message. Call conversations list and then
    // fetch messages for the most recent conversation.

    const convsRes = await fetch(`${DIFY_API_BASE}/v1/conversations`, {
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

    const convsJson = await convsRes.json().catch(()=>({ items: [] })) as any
    const items: any[] = convsJson.items || convsJson.conversations || []
    if (!items.length) {
      // no existing conversations — return an empty assistant welcome (client may show default)
      return new Response(JSON.stringify({ messages: [{ role: 'assistant', content: '' }] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Pick the most recent conversation (assume first or sort by updatedAt)
    let conv = items[0]
    if (items.length > 1) {
      items.sort((a,b)=>{
        const ta = new Date(a.updated_at || a.updatedAt || 0).getTime()
        const tb = new Date(b.updated_at || b.updatedAt || 0).getTime()
        return tb - ta
      })
      conv = items[0]
    }

    const convId = conv.id || conv.conversation_id || conv.conversationId
    if (!convId) {
      return new Response(JSON.stringify({ messages: [{ role: 'assistant', content: '' }] }), { headers: { 'Content-Type': 'application/json' } })
    }

    // Try conversation messages endpoint, fallback to messages query endpoint
    let msgsRes = await fetch(`${DIFY_API_BASE}/v1/conversations/${convId}/messages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' }
    })

    if (!msgsRes.ok) {
      // fallback
      msgsRes = await fetch(`${DIFY_API_BASE}/v1/messages?conversation_id=${encodeURIComponent(convId)}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${DIFY_API_KEY}`, 'Content-Type': 'application/json' }
      })
    }

    if (!msgsRes.ok) {
      const text = await msgsRes.text().catch(()=>"")
      console.error('Dify messages error', msgsRes.status, text)
      return new Response(JSON.stringify({ error: 'dify_error', detail: text }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }

    const msgsJson = await msgsRes.json().catch(()=>({ messages: [] })) as any
    const messagesRaw: any[] = msgsJson.items || msgsJson.messages || []

    // Map upstream messages to { role, content }
    const mapped = messagesRaw.map(m => {
      const role = m.role || m.author?.role || (m.from === 'assistant' ? 'assistant' : 'user')
      const content = m.content || m.text || m.body || (m.outputs && m.outputs.text) || ''
      return { role, content }
    }).filter(m=>m.content)

    return new Response(JSON.stringify({ messages: mapped }), { headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Dify init proxy error', err)
    return new Response(JSON.stringify({ error: 'proxy_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export const runtime = 'nodejs'
