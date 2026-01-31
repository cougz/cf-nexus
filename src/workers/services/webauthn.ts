import * as WebAuthnLib from '@passwordless-id/webauthn';

import type { Credential, User } from '../../types';

export interface RegistrationOptions {
  username: string;
  challenge: string;
  user?: User;
}

export interface AuthenticationOptions {
  username: string;
  challenge: string;
  credentials: Credential[];
}

export interface RegistrationResult {
  verified: boolean;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: string;
  backedUp: boolean;
}

export interface AuthenticationResult {
  verified: boolean;
  counter: number;
}

export function generateRegistrationOptions(
  username: string,
  challenge: string,
  user?: User
): any {
  const options: any = {
    challenge,
    rp: {
      name: 'Nexus Identity Provider',
      id: process.env.RP_ID || 'localhost'
    },
    user: user ? {
      id: user.id,
      name: user.username,
      displayName: user.displayName || user.username
    } : {
      id: crypto.randomUUID(),
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },
      { type: 'public-key', alg: -257 }
    ],
    timeout: 60000,
    attestation: 'direct',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred'
    }
  };

  return options;
}

export async function verifyRegistration(
  credential: any,
  challenge: string
): Promise<RegistrationResult> {
  try {
    const clientDataJSON = atob(base64UrlToBase64(credential.response.clientDataJSON));
    const clientData = JSON.parse(clientDataJSON);

    const challengeCheck = base64UrlToBase64Url(clientData.challenge);

    if (challengeCheck !== challenge) {
      return {
        verified: false,
        credentialId: '',
        publicKey: '',
        counter: 0,
        transports: [],
        deviceType: '',
        backedUp: false
      };
    }

    const credentialId = credential.id;
    const publicKey = credential.response.publicKey;

    return {
      verified: true,
      credentialId,
      publicKey: JSON.stringify(publicKey),
      counter: 0,
      transports: credential.response.transports || [],
      deviceType: credential.authenticatorAttachment || 'singleDevice',
      backedUp: credential.response.clientExtensionResults?.credProps?.bk ?? false
    };
  } catch (error) {
    console.error('Registration verification error:', error);
    return {
      verified: false,
      credentialId: '',
      publicKey: '',
      counter: 0,
      transports: [],
      deviceType: '',
      backedUp: false
    };
  }
}

export function generateAuthenticationOptions(
  challenge: string,
  credentials: Credential[]
): any {
  const allowCredentials = credentials.map((cred) => ({
    id: base64UrlToBase64(cred.credentialId),
    type: 'public-key',
    transports: cred.transports
  }));

  return {
    challenge,
    allowCredentials,
    rpId: process.env.RP_ID || 'localhost',
    userVerification: 'preferred',
    timeout: 60000
  };
}

export async function verifyAuthentication(
  assertion: any,
  challenge: string,
  credential: Credential
): Promise<AuthenticationResult> {
  try {
    const clientDataJSON = atob(base64UrlToBase64(assertion.response.clientDataJSON));
    const clientData = JSON.parse(clientDataJSON);

    const challengeCheck = base64UrlToBase64Url(clientData.challenge);

    if (challengeCheck !== challenge) {
      return { verified: false, counter: credential.counter };
    }

    return {
      verified: true,
      counter: credential.counter + 1
    };
  } catch (error) {
    console.error('Authentication verification error:', error);
    return { verified: false, counter: credential.counter };
  }
}

function base64UrlToBase64(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return base64;
}

function base64UrlToBase64Url(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
