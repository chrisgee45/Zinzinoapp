import type { NextFunction, Request, Response } from "express";
import { type Partner } from "../../shared/schema.js";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";
import { loadPartnerById } from "../lib/loadPartner.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
      partner?: Partner;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const cookieToken = (req as Request & { cookies?: Record<string, string> }).cookies?.bfa_token;
  if (cookieToken) return cookieToken;
  return null;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  const partner = await loadPartnerById(payload.sub);
  if (!partner) {
    res.status(401).json({ error: "Account not found" });
    return;
  }
  req.auth = payload;
  req.partner = partner;
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) return next();
  const payload = verifyToken(token);
  if (!payload) return next();
  const partner = await loadPartnerById(payload.sub);
  if (partner) {
    req.auth = payload;
    req.partner = partner;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.partner?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
