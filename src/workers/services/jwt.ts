import { SignJWT, jwtVerify, exportJWK } from 'jose';
import type { JWKS, JWKKey } from '../../types';
import { arrayBufferToBase64Url } from './crypto';

const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || '';
const ISSUER = process.env.ISSUER || 'http://localhost:8788';

let privateKey: any = null;
let cachedJWK: JWKKey | null = null;

async function getPrivateKey() {
  if (privateKey) {
    return privateKey;
  }

  if (!JWT_PRIVATE_KEY) {
    throw new Error('JWT_PRIVATE_KEY not configured');
  }

  return JWT_PRIVATE_KEY;
}

async function getPublicKey() {
  const privateKey = await getPrivateKey();
  return (privateKey as any).publicKey;
}

export async function signIdToken(
  userId: string,
  audience: string,
  nonce?: string,
  scope?: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    sub: userId,
    aud: audience,
    iss: ISSUER,
    exp: now + 3600,
    iat: now,
    auth_time: now,
    nonce,
    scope
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);

  return jwt;
}

export async function signAccessToken(
  userId: string,
  audience: string,
  scope?: string
): Promise<string> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    sub: userId,
    aud: audience,
    iss: ISSUER,
    exp: now + 3600,
    iat: now,
    scope
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'at+jwt' })
    .sign(privateKey);

  return jwt;
}

export async function verifyToken(token: string): Promise<any> {
  try {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
      issuer: ISSUER,
      algorithms: ['RS256']
    });

    return payload;
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error('Invalid token');
  }
}

export async function getJWKS(): Promise<JWKS> {
  if (cachedJWK) {
    return { keys: [cachedJWK] };
  }

  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  
  const kid = arrayBufferToBase64Url(crypto.getRandomValues(new Uint8Array(8)).buffer);
  
  cachedJWK = {
    kty: (jwk as any).kty || 'RSA',
    kid,
    use: 'sig',
    alg: 'RS256',
    n: (jwk as any).n || '',
    e: (jwk as any).e || ''
  };

  return { keys: [cachedJWK] };
}

export function clearJWKCache(): void {
  cachedJWK = null;
}
