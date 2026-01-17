import { NextRequest } from 'next/server'
import config, { getDifyKey } from '@/config'

// サーバー側プロキシ: フロントからのリクエストを受け、Dify API に中継する
export async function POST(req: Request) {
  try {
    const DIFY_API_KEY = getDifyKey()
    const DIFY_API_BASE = (config.dify?.apiBase || 'https://api.dify.ai')

    if (!DIFY_API_KEY) {
      return new Response(JSON.stringify({ error: 'DIFY_API_KEY not configured on server' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }

    // If the incoming request is multipart/form-data (file upload + message),
    // forward to the ingestion backend so it can handle uploads and processing.
    const incomingContentType = (req.headers.get('content-type')) || ''
    const tenantId = req.headers.get('x-tenant-id') || ''
    const userId = req.headers.get('x-user-id') || ''

    if (incomingContentType.startsWith('multipart/')) {
      // Handle file uploads by proxying files to Dify cloud API rather than local ingestion service.
      try {
        // Parse incoming form data
        const form = await req.formData()
        // Collect files under common keys (files, file)
        const files: any[] = []
        for (const key of form.keys()) {
          const v = form.getAll(key)
          for (const item of v) {
            // file-like objects from Request.formData are of type File/Blob
            if ((item as any)?.name || (item as any)?.size !== undefined) files.push(item)
          }
        }

        const uploadedFileIds: string[] = []

        for (const f of files) {
          const fd = new FormData()
          // `f` is a File/Blob; append with a filename when available
          fd.append('file', f, (f as any).name || 'upload')

          const upRes = await fetch(`${DIFY_API_BASE}/v1/files/upload`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DIFY_API_KEY}`,
            },
            body: fd,
          })

          if (!upRes.ok) {
            const t = await upRes.text().catch(() => '')
            console.error('Dify file upload failed', upRes.status, t)
            return new Response(JSON.stringify({ error: 'dify_file_upload_failed', status: upRes.status, body: t }), { status: 502, headers: { 'Content-Type': 'application/json' } })
          }

          const upJson = await upRes.json().catch(() => ({})) as any
          // Dify may return file_id or id; try common keys
          const fileId = upJson.file_id || upJson.id || upJson.data?.id
          if (fileId) uploadedFileIds.push(String(fileId))
        }

        // Build chat payload referencing uploaded files
        const textField = form.get('input') || form.get('message') || ''
        const query = typeof textField === 'string' ? textField : ''

        const base = DIFY_API_BASE.replace(/\/+$/, '')
        const endpoint = base.endsWith('/v1') ? `${base}/chat-messages` : `${base}/v1/chat-messages`

        const dBody: any = {
          query: query || '',
          inputs: { files: uploadedFileIds },
          response_mode: 'streaming',
        }
        // Use userId/tenantId derived from headers as earlier in the handler
        if (userId) dBody.user = userId
        else dBody.user = tenantId || 'web-anonymous'
        if (tenantId) dBody.tenant_id = tenantId

        const upstream = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DIFY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dBody),
        })

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => '')
          console.error('Dify chat-messages error', upstream.status, text)
          return new Response(JSON.stringify({ error: 'upstream_error', status: upstream.status, body: text }), { status: 502, headers: { 'Content-Type': 'application/json' } })
        }

        // Stream response back to client
        const resHeaders = new Headers()
        const contentType = upstream.headers.get('content-type')
        if (contentType) resHeaders.set('Content-Type', contentType)
        return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
      } catch (e) {
        console.error('Error proxying multipart to Dify', e)
        return new Response(JSON.stringify({ error: 'upstream_exception', message: String(e) }), { status: 502, headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Otherwise assume JSON/text chat messages -> call Dify /chat-messages.
    // Build request payload expected by Dify and support bases with or without `/v1`.
    const base = DIFY_API_BASE.replace(/\/+$/, '')
    const endpoint = base.endsWith('/v1') ? `${base}/chat-messages` : `${base}/v1/chat-messages`

    // Read incoming JSON body (may include `input` or `messages` shape).
    const incoming = await req.json().catch(() => ({})) as any
    // Derive `query` for Dify: prefer `input`, otherwise join message contents.
    let query = ''
    if (typeof incoming.input === 'string' && incoming.input.trim()) query = incoming.input.trim()
    else if (Array.isArray(incoming.messages) && incoming.messages.length) query = incoming.messages.map((m: any) => m.content || '').join('\n')

    const user = incoming.userId || incoming.user || userId || tenantId || 'web-anonymous'
    const conversation_id = incoming.conversation_id || incoming.conversationId || undefined
    const trace_id = req.headers.get('x-trace-id') || incoming.trace_id || undefined

    const dBody: any = {
      query,
      inputs: incoming.inputs || {},
      response_mode: 'streaming',
    }
    if (user) dBody.user = user
    if (conversation_id) dBody.conversation_id = conversation_id
    if (trace_id) dBody.trace_id = trace_id

    try {
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${DIFY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dBody)
      })

      // Proxy status and content-type; stream body directly
      const resHeaders = new Headers()
      const contentType = upstream.headers.get('content-type')
      if (contentType) resHeaders.set('Content-Type', contentType)

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        console.error('Dify upstream error', upstream.status, text)
        return new Response(JSON.stringify({ error: 'upstream_error', status: upstream.status, body: text }), { status: 502, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(upstream.body, { status: upstream.status, headers: resHeaders })
    } catch (e) {
      console.error('Error proxying to Dify', e)
      return new Response(JSON.stringify({ error: 'proxy_exception', message: String(e) }), { status: 502, headers: { 'Content-Type': 'application/json' } })
    }
  } catch (err) {
    console.error('Dify proxy error', err)
    return new Response(JSON.stringify({ error: 'proxy_error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export const runtime = 'nodejs'
