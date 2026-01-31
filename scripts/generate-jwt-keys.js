#!/usr/bin/env node

import crypto from 'crypto';

console.log('Generating RSA 2048-bit key pair for JWT signing...\n');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

console.log('Public Key (for JWKS):');
console.log('='.repeat(60));
console.log(publicKey);
console.log('\n');

console.log('Private Key (store as JWT_PRIVATE_KEY secret):');
console.log('='.repeat(60));
console.log(privateKey);
console.log('\n');

console.log('To store the private key in Cloudflare Workers:');
console.log('  wrangler secret put JWT_PRIVATE_KEY');
console.log('');
console.log('Paste the entire Private Key (including -----BEGIN/END lines)');
