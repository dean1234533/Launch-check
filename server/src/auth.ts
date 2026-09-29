import { createHash } from "node:crypto";
import type { Request } from "express";
import type { Db } from "./db.js";
import { githubClient } from "./github.js";
import { upsertUser, type User } from "./users.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export interface GithubIdentity {
  id: number;
  login: string;
}
export type ResolveGithubUser = (token: string) => Promise<GithubIdentity>;

export const resolveGithubUser: ResolveGithubUser = async (token) => {
  const { data } = await githubClient(token).users.getAuthenticated();
  return { id: data.id, login: data.login };
};

export function bearerToken(req: Request): string {
  const token = (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing GitHub token. Add one in the extension settings.");
  return token;
}

const IDENTITY_TTL_MS = 5 * 60 * 1000;

/**
 * The account is the GitHub user behind the token, so there is no separate sign-up.
 * Token -> identity lookups are cached briefly (keyed by hash; the token itself is never stored).
 */
export function makeAuthenticator(db: Db, resolve: ResolveGithubUser = resolveGithubUser) {
  const cache = new Map<string, { identity: GithubIdentity; expires: number }>();
  return async (req: Request): Promise<{ user: User; token: string }> => {
    const token = bearerToken(req);
    const key = createHash("sha256").update(token).digest("hex");
    let hit = cache.get(key);
    if (!hit || hit.expires < Date.now()) {
      hit = { identity: await resolve(token), expires: Date.now() + IDENTITY_TTL_MS };
      cache.set(key, hit);
      if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    }
    return { user: upsertUser(db, hit.identity.id, hit.identity.login), token };
  };
}
