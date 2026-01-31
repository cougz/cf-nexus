import type { JWTVerifyResult } from 'jose'
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose'

export interface KeyPair {
  privateKey: string
  publicKey: string
  kid: string
}

export async function generateKeyPair(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  )

  const privateKeyExport = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const publicKeyExport = await crypto.subtle.exportKey('spki', keyPair.publicKey)

  const privateKey = formatPEM(privateKeyExport, 'PRIVATE KEY')
  const publicKey = formatPEM(publicKeyExport, 'PUBLIC KEY')
  const kid = await getKeyId(privateKey)

  return {
    privateKey,
    publicKey,
    kid,
  }
}

function formatPEM(data: ArrayBuffer, label: string): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

export async function signJWT(
  payload: Record<string, unknown>,
  privateKey: string
): Promise<string> {
  const key = await importPKCS8(privateKey, 'RS256')

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: await getKeyId(privateKey) })
    .setIssuedAt()
    .sign(key)

  return jwt
}

export async function verifyJWT(token: string, publicKeyOrKey: string): Promise<JWTVerifyResult> {
  const key = await importSPKI(publicKeyOrKey, 'RS256')

  const { payload, protectedHeader } = await jwtVerify(token, key)

  return { payload, protectedHeader }
}

export async function getJWKS(privateKey: string): Promise<{ keys: Record<string, string>[] }> {
  const kid = await getKeyId(privateKey)

  const publicKeyJwk = {
    kty: 'RSA',
    n: 'public_key_modulus_placeholder',
    e: 'AQAB',
  }

  return {
    keys: [
      {
        kty: publicKeyJwk.kty,
        use: 'sig',
        alg: 'RS256',
        kid,
        n: publicKeyJwk.n,
        e: publicKeyJwk.e,
      },
    ],
  }
}

async function getKeyId(key: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key.slice(0, 100)))
  const hashArray = Array.from(new Uint8Array(hash))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex.substring(0, 16)
}
