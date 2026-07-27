import { hash, verify } from '@node-rs/argon2';

/** Argon2id (the OWASP-recommended algorithm) with the library's defaults,
 * which meet current OWASP minimums (m=19 MiB, t=2, p=1). Passwords are never
 * stored, logged, or returned — only this one-way hash is persisted. */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Used on login for unknown emails so the request takes the same time as a
 * real verification — otherwise response timing reveals which emails exist. */
export const DUMMY_HASH_PROMISE = hashPassword('dummy-timing-equalizer');
