import { SignJWT, jwtVerify, exportJWK, importKey } from 'jose';
import type { JWKS, JWKKey } from '../../types';
import { arrayBufferToBase64Url } from './crypto';

const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY || '';
const ISSUER = process.env.ISSUER || 'http://localhost:8788';

let privateKeyObj: KeyObject | null = null;
let cachedJWK: JWKKey | null = null;

async function getPrivateKey(): Promise<KeyObject> {
  if (privateKeyObj) {
    return privateKeyObj;
  }

  if (!JWT_PRIVATE_KEY) {
    throw new Error('JWT_PRIVATE_KEY not configured');
  }

  const binary = Uint8Array.from(
    atob(JWT_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
      .replace(/\n/g, '')), 
    c => c.charCodeAt(0)
  );

  privateKeyObj = await importKey('pkcs8', binary.buffer, { extractable: false }, 'private');
  return privateKeyObj;
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
    const privateKey = await getPrivateKey();
    const publicKey = await privateKey.export({ format: 'spki' });
    
    const publicCryptoKey = await importKey('spki', publicKey, { extractable: false }, 'public');
    
    const { payload } = await jwtVerify(token, publicCryptoKey, {
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

  const privateKey = await getPrivateKey();
  const publicKey = await privateKey.export({ format: 'spki' });
  const jwk = await exportJWK(await importKey('spki', publicKey, { extractable: false }, 'public'));
  
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
