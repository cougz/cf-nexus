import { describe, it, expect } from 'vitest';

import {
  arrayBufferToBase64Url,
  base64UrlToArrayBuffer,
  generateToken,
  hashToken,
  verifyTokenHash
} from '../../src/workers/services/crypto';

describe('Crypto Service', () => {
  describe('arrayBufferToBase64Url', () => {
    it('should convert ArrayBuffer to base64url', () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const result = arrayBufferToBase64Url(buffer);
      expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(result).not.toContain('=');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });

    it('should handle empty buffer', () => {
      const buffer = new Uint8Array([]).buffer;
      const result = arrayBufferToBase64Url(buffer);
      expect(result).toBe('');
    });
  });

  describe('base64UrlToArrayBuffer', () => {
    it('should convert base64url to ArrayBuffer', () => {
      const base64Url = 'AQIDBAUGBwgJCgsMDQ4PEB';
      const result = base64UrlToArrayBuffer(base64Url);
      expect(result).toBeInstanceOf(ArrayBuffer);
      const bytes = new Uint8Array(result);
      expect(bytes.length).toBeGreaterThan(0);
    });

    it('should handle padding', () => {
      const base64Url = 'AQ';
      const result = base64UrlToArrayBuffer(base64Url);
      expect(result).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('generateToken', () => {
    it('should generate random token of specified length', () => {
      const token = generateToken(16);
      expect(token.length).toBeGreaterThan(0);
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('should generate tokens with different values', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('hashToken', async () => {
    it('should hash token with SHA-256', async () => {
      const token = 'test-token';
      const hash = await hashToken(token);
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(hash).not.toContain('=');
    });

    it('should produce consistent hashes for same input', async () => {
      const token = 'consistent-token';
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await hashToken('token1');
      const hash2 = await hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyTokenHash', async () => {
    it('should return true for matching hash', async () => {
      const token = 'test-token';
      const hash = await hashToken(token);
      const result = await verifyTokenHash(token, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching hash', async () => {
      const token = 'test-token';
      const wrongHash = 'wrong-hash';
      const result = await verifyTokenHash(token, wrongHash);
      expect(result).toBe(false);
    });
  });
});
