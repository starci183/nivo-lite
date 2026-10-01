import { createHmac } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { NIVO_OPTIONS, type NivoOptions } from "../nivo/nivo.config";
import { deriveKey, safeEqual } from "../nivo/signing";

export type ToolClaims = { readonly jobId: string; readonly workspaceId: string; readonly conversationId: string; readonly exp: number };

const MAX_CALLS_PER_JOB = 25;

/**
 * Short-lived per-job tokens for the tool bridge. A token is bound to ONE job (and so to one workspace and one conversation), expires
 * with it, and is only honoured while that job is running on this worker. OpenClaw never gets a credential that outlives the turn.
 */
@Injectable()
export class ToolTokenService {
  private readonly key: string;
  private readonly active = new Map<string, number>();

  constructor(@Inject(NIVO_OPTIONS) options: NivoOptions) {
    this.key = deriveKey(options.sharedSecret, "tool-token:v1");
  }

  /** Mint a token valid for `ttlSeconds` and mark the job active. Call `revoke` when the job ends. */
  mint(claims: Omit<ToolClaims, "exp">, ttlSeconds: number): string {
    const full: ToolClaims = { ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
    const body = Buffer.from(JSON.stringify(full)).toString("base64url");
    this.active.set(claims.jobId, 0);
    return `${body}.${this.mac(body)}`;
  }

  revoke(jobId: string): void {
    this.active.delete(jobId);
  }

  /** The claims of a valid, unexpired token of a job that is still running here; null otherwise. Counts the call against the per-job cap. */
  verify(token: string | undefined): ToolClaims | null {
    if (!token) return null;
    const [body, mac] = token.split(".");
    if (!body || !mac || !safeEqual(this.mac(body), mac)) return null;
    let claims: ToolClaims;
    try {
      claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ToolClaims;
    } catch {
      return null;
    }
    if (typeof claims.jobId !== "string" || typeof claims.workspaceId !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp < Date.now() / 1000) return null;
    const calls = this.active.get(claims.jobId);
    if (calls === undefined || calls >= MAX_CALLS_PER_JOB) return null;
    this.active.set(claims.jobId, calls + 1);
    return claims;
  }

  private mac(body: string): string {
    return createHmac("sha256", this.key).update(body).digest("base64url");
  }
}
