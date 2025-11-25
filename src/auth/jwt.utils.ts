import { createHmac } from 'crypto';

type JwtHeader = {
  alg: 'HS256';
  typ: 'JWT';
};

export type JwtPayload = Record<string, unknown> & {
  exp: number;
  sub: string;
};

const base64UrlEncode = (input: string | Buffer): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

const base64UrlDecode = (input: string): string => {
  const padLength = 4 - (input.length % 4 || 4);
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLength % 4);
  return Buffer.from(normalized, 'base64').toString('utf8');
};

export const signJwt = (payload: JwtPayload, secret: string): string => {
  const header: JwtHeader = { alg: 'HS256', typ: 'JWT' };
  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerEncoded}.${payloadEncoded}`;
  const signature = createHmac('sha256', secret).update(data).digest();
  const signatureEncoded = base64UrlEncode(signature);
  return `${data}.${signatureEncoded}`;
};

export const verifyJwt = (token: string, secret: string): JwtPayload => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT structure.');
  }
  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const data = `${headerEncoded}.${payloadEncoded}`;
  const expectedSignature = createHmac('sha256', secret).update(data).digest();
  const expectedSignatureEncoded = base64UrlEncode(expectedSignature);
  if (signatureEncoded !== expectedSignatureEncoded) {
    throw new Error('JWT signature mismatch.');
  }

  const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('JWT expired.');
  }

  if (!payload.sub) {
    throw new Error('JWT missing subject.');
  }

  return payload;
};
