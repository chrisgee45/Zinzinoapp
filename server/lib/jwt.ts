import jwt, { type SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
// A year. Partners log into the iPhone app once and stay logged in.
// The /api/auth/me endpoint slides the expiry on every boot, so an
// active user is effectively never signed out.
const DEFAULT_TTL: SignOptions["expiresIn"] = "365d";

export interface TokenPayload {
  sub: number;
  email: string;
  isAdmin: boolean;
}

export function signToken(payload: TokenPayload, ttl: SignOptions["expiresIn"] = DEFAULT_TTL): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ttl });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload & { iat: number; exp: number };
    return { sub: decoded.sub, email: decoded.email, isAdmin: decoded.isAdmin };
  } catch {
    return null;
  }
}
