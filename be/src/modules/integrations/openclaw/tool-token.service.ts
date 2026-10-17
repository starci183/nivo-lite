import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { isJsonObject } from "./json.mapper"
import type { ToolClaims, ToolTokenSubject, VerifiedToolClaims } from "./openclaw.contracts"
import { InjectOpenclawOptions } from "./openclaw.decorators"
import { OpenclawLogEvent } from "./openclaw.log-events"
import type { OpenclawOptions } from "./openclaw.options"

/** The most tool calls one job's token may make. */
const MAX_CALLS_PER_JOB = 25
const KEY_CONTEXT = "tool-token:v1"
const KEY_BYTES = 32

@Injectable()
/**
 * Short-lived per-job tokens for the tool bridge. A token is bound to one job (hence to one workspace and one
 * conversation), expires with it, and is honoured only while that job runs in this process. OpenClaw never holds a
 * credential that outlives the turn.
 */
export class ToolTokenService {
    private readonly key: Buffer | null
    private readonly active = new Map<string, number>()

    constructor(
        @InjectOpenclawOptions() options: OpenclawOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.key =
            options.toolSecret === null
                ? null
                : Buffer.from(hkdfSync("sha256", options.toolSecret.reveal(), "", KEY_CONTEXT, KEY_BYTES))
    }

    /**
     * Mints a token valid for `ttlSeconds` and marks the job active; an empty text when the tool bridge has no secret.
     * Call `revoke` when the job ends.
     */
    mint(subject: ToolTokenSubject, ttlSeconds: number): string {
        if (this.key === null) return ""
        const claims: ToolClaims = { ...subject, exp: Math.floor(this.clock.now().getTime() / 1000) + ttlSeconds }
        const body = Buffer.from(JSON.stringify(claims)).toString("base64url")
        this.active.set(subject.jobId, 0)
        return `${body}.${this.macOf(this.key, body)}`
    }

    /** Ends the token of a job. */
    revoke(jobId: string): void {
        this.active.delete(jobId)
    }

    /**
     * The claims of a valid, unexpired token of a job still running here; null otherwise. Consumes one call by default;
     * admission may inspect without consuming.
     */
    verify(token: string, consume: boolean = true): VerifiedToolClaims {
        const [body = "", mac = ""] = token.split(".")
        if (this.key === null || body === "" || mac === "") return null
        if (!this.same(this.macOf(this.key, body), mac)) return null
        const claims = this.claimsOf(body)
        if (claims === null || claims.exp < this.clock.now().getTime() / 1000) return null
        const calls = this.active.get(claims.jobId)
        if (calls === undefined || calls >= MAX_CALLS_PER_JOB) return null
        if (consume) this.active.set(claims.jobId, calls + 1)
        return claims
    }

    private claimsOf(body: string): VerifiedToolClaims {
        try {
            const value: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
            if (!isJsonObject(value)) return null
            const { jobId, workspaceId, conversationId, exp } = value
            const valid =
                typeof jobId === "string" &&
                typeof workspaceId === "string" &&
                typeof conversationId === "string" &&
                typeof exp === "number"
            return valid ? { jobId, workspaceId, conversationId, exp } : null
        } catch (cause) {
            this.logger.error(OpenclawLogEvent.ToolGrantUnreadable, cause)
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
