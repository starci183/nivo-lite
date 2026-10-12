import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { ToolClaims } from "./openclaw.contracts"
import { InjectOpenclawOptions } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"

/** The most tool calls one job's token may make. */
const MAX_CALLS_PER_JOB = 25
const KEY_CONTEXT = "tool-token:v1"

@Injectable()
/**
 * Short-lived per-job tokens for the tool bridge. A token is bound to one job (hence to one workspace and one conversation), expires
 * with it, and is honoured only while that job runs in this process. OpenClaw never holds a credential that outlives the turn.
 */
export class ToolTokenService {
    private readonly key: Buffer | null
    private readonly active = new Map<string, number>()

    constructor(
        @InjectOpenclawOptions() options: OpenclawOptions,
        @InjectClock() private readonly clock: Clock,
    ) {
        this.key =
            options.toolSecret === null
                ? null
                : Buffer.from(hkdfSync("sha256", options.toolSecret.reveal(), "", KEY_CONTEXT, 32))
    }

    /** Mints a token valid for `ttlSeconds` and marks the job active; null when the tool bridge has no secret. Call `revoke` when the job ends. */
    mint(claims: Omit<ToolClaims, "exp">, ttlSeconds: number): string | null {
        if (this.key === null) return null
        const full: ToolClaims = { ...claims, exp: Math.floor(this.clock.now().getTime() / 1000) + ttlSeconds }
        const body = Buffer.from(JSON.stringify(full)).toString("base64url")
        this.active.set(claims.jobId, 0)
        return `${body}.${this.macOf(this.key, body)}`
    }

    /** Ends the token of a job. */
    revoke(jobId: string): void {
        this.active.delete(jobId)
    }

    /** The claims of a valid, unexpired token of a job still running here; null otherwise. Counts the call against the per-job cap. */
    verify(token: string | undefined): ToolClaims | null {
        if (this.key === null || token === undefined) return null
        const [body, mac] = token.split(".")
        if (body === undefined || mac === undefined || body === "" || mac === "") return null
        if (!this.same(this.macOf(this.key, body), mac)) return null
        const claims = this.claimsOf(body)
        if (claims === null || claims.exp < this.clock.now().getTime() / 1000) return null
        const calls = this.active.get(claims.jobId)
        if (calls === undefined || calls >= MAX_CALLS_PER_JOB) return null
        this.active.set(claims.jobId, calls + 1)
        return claims
    }

    private claimsOf(body: string): ToolClaims | null {
        try {
            const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<ToolClaims>
            const valid =
                typeof value.jobId === "string" &&
                typeof value.workspaceId === "string" &&
                typeof value.conversationId === "string" &&
                typeof value.exp === "number"
            return valid ? (value as ToolClaims) : null
        } catch {
            return null
        }
    }

    private macOf(key: Buffer, body: string): string {
        return createHmac("sha256", key).update(body).digest("base64url")
    }

    private same(expected: string, given: string): boolean {
        const a = Buffer.from(expected)
        const b = Buffer.from(given)
        return a.length === b.length && timingSafeEqual(a, b)
    }
}
