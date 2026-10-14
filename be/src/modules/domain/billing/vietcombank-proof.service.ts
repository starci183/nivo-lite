import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectWebhookProofRegistry } from "@modules/platform/http-security"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "@modules/platform/http-security"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { PaymentProofService } from "./payment-proof.service"

@Injectable()
/** The simulated Vietcombank door's proof of the configured platform bank secret. */
export class VietcombankProofService implements WebhookProof, OnModuleInit {
    /** The provider key used by the simulated Vietcombank door. */
    readonly provider = "vietcombank"

    constructor(
        @InjectWebhookProofRegistry() private readonly registry: WebhookProofRegistry,
        private readonly payments: PaymentProofService,
    ) {}

    /** Registers this proof for the simulated Vietcombank door. */
    onModuleInit(): void {
        this.registry.add(this)
    }

    /** Checks the bank-secret header against the configured platform secret; the route scope is unused. */
    prove(request: WebhookProofRequest): Promise<boolean> {
        return Promise.resolve().then(() => this.accepts(request.signature))
    }

    private accepts(secret: string | undefined): boolean {
        try {
            this.payments.verifySimulatedBank(secret)
            return true
        } catch (cause) {
            if (cause instanceof BillingError && cause.code === BillingErrorCode.WebhookUnauthorized) return false
            throw cause
        }
    }
}
