import bcrypt from "bcryptjs";

const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

const PHONE_RE = /^1[3-9]\d{9}$/;

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim().replace(/\s|-/g, "");
  if (!PHONE_RE.test(trimmed)) return null;
  return trimmed;
}
