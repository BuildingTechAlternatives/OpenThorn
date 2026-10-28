import { supabase } from './supabase'

// Provider API keys are encrypted at rest. Two schemes exist:
//
//   senc:  Server-side AES-256-GCM, keyed by a server-held secret combined with
//          the user id (see api/_shared.ts). A database dump alone cannot be
//          decrypted without the server secret. This is the default.
//   enc:   Legacy client-side AES-256-GCM, keyed only from the user id. Kept for
//          backward compatibility and used as a fallback when the server
//          endpoint is unavailable (e.g. local dev without KEY_ENCRYPTION_SECRET).

const SALT = 'openthorn-v1-key-encryption'
const serverKeyOps = new Map<string, Promise<string | null>>()
const serverDecryptResults = new Map<string, string>()

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(SALT), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function clientEncrypt(plaintext: string, userId: string): Promise<string> {
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const ivHex = Array.from(iv, b => b.toString(16).padStart(2, '0')).join('')
  return `enc:${ivHex}:${bytesToBase64(new Uint8Array(ciphertext))}`
}

async function clientDecrypt(stored: string, userId: string): Promise<string> {
  const firstColon = stored.indexOf(':', 4)
  const ivHex = stored.slice(4, firstColon)
  const ctBase64 = stored.slice(firstColon + 1)
  const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))
  const ct = base64ToBytes(ctBase64)
  const key = await deriveKey(userId)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(plain)
}

/** Call the server key endpoint. Returns the result, or null if unavailable. */
async function serverKeyOp(action: 'encrypt' | 'decrypt', value: string): Promise<string | null> {
  if (action === 'decrypt') {
    const cached = serverDecryptResults.get(value)
    if (cached) return cached
  }

  const cacheKey = `${action}:${value}`
  const existing = serverKeyOps.get(cacheKey)
  if (existing) return existing

  const op = runServerKeyOp(action, value)
  serverKeyOps.set(cacheKey, op)
  if (action === 'decrypt') {
    op.then((result) => {
      if (result) serverDecryptResults.set(value, result)
    })
  }
  op.finally(() => serverKeyOps.delete(cacheKey))
  return op
}

async function runServerKeyOp(action: 'encrypt' | 'decrypt', value: string): Promise<string | null> {
  let token: string | undefined
  try {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token
  } catch {
    token = undefined
  }
  if (!token) return null

  try {
    const res = await fetch('/api/provider-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, value }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: unknown }
    return typeof data.result === 'string' ? data.result : null
  } catch {
    return null
  }
}

export async function encryptApiKey(plaintext: string, userId: string): Promise<string> {
  const server = await serverKeyOp('encrypt', plaintext)
  if (server && server.startsWith('senc:')) return server
  // Fallback: server not configured/reachable — encrypt client-side.
  return clientEncrypt(plaintext, userId)
}

export async function decryptApiKey(stored: string, userId: string): Promise<string> {
  if (stored.startsWith('senc:')) {
    const server = await serverKeyOp('decrypt', stored)
    if (server === null) throw new Error('Unable to decrypt provider key')
    return server
  }
  if (stored.startsWith('enc:')) return clientDecrypt(stored, userId)
  return stored
}
