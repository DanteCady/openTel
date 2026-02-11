import jwt from "jsonwebtoken";

export interface TokenPayload {
  tenantId: string;
  endpointId?: string;
  scopes?: string[];
}

export function mintToken(secret: string, payload: TokenPayload, expiresIn: string | number = "24h"): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(secret: string, token: string): TokenPayload {
  const decoded = jwt.verify(token, secret) as TokenPayload & { iat?: number; exp?: number };
  return {
    tenantId: decoded.tenantId,
    endpointId: decoded.endpointId,
    scopes: decoded.scopes,
  };
}
