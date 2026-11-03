import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import { HttpSecurityLogEvent } from "./http-security.log-events"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "./webhook-proof.port"

/** A refusal of one provider and scope is logged at most once per this long; the ones in between are counted into the next line. */
export const REFUSAL_LOG_WINDOW_MS = 60_000

/** When a provider and scope was last logged, and how many refusals since were left out. */
interface RefusalLogged {
    readonly at: number
    readonly suppressed: number
}

@Injectable()
/** The proofs of the providers whose secrets are stored per scope; modules add theirs once at start. */
export class WebhookProofRegistryService implements WebhookProofRegistry {
    private readonly proofs = new Map<string, WebhookProof>()
    private readonly logged = new Map<string, RefusalLogged>()

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Registers the proof; a provider has exactly one. */
    add(proof: WebhookProof): void {
        if (this.proofs.has(proof.provider)) {
            throw new HttpSecurityError({
                code: HttpSecurityErrorCode.WebhookProviderUnknown,
                params: { provider: proof.provider },
            })
        }
        this.proofs.set(proof.provider, proof)
    }

    /** Enforces the registered proof and retains the shared HTTP security refusal codes; a refused proof leaves one log line per provider and scope per minute. */
    async verify(provider: string, request: WebhookProofRequest): Promise<void> {
        const proof = this.proofs.get(provider)
        if (proof === undefined) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookProviderUnknown, params: { provider } })
        }
        if (!(await proof.prove(request))) {
            this.logRefusal(proof, request)
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })
        }
    }

    private logRefusal(proof: WebhookProof, request: WebhookProofRequest): void {
        const now = this.clock.now().getTime()
        const key = `${proof.provider}:${request.scope}`
        for (const [other, entry] of this.logged) {
            if (now - entry.at >= REFUSAL_LOG_WINDOW_MS && other !== key) this.logged.delete(other)
        }
        const before = this.logged.get(key)
        if (before !== undefined && now - before.at < REFUSAL_LOG_WINDOW_MS) {
            this.logged.set(key, { at: before.at, suppressed: before.suppressed + 1 })
            return
        }
        this.logged.set(key, { at: now, suppressed: 0 })
        this.logger.warn(HttpSecurityLogEvent.WebhookRefused, {
            provider: proof.provider,
            scope: request.scope,
            code: HttpSecurityErrorCode.WebhookSignatureInvalid,
            ...(proof.facts?.(request) ?? {}),
            ...(before === undefined || before.suppressed === 0 ? {} : { suppressed: before.suppressed }),
        })
    }
}
