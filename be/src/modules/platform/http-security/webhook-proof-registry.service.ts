import { Injectable } from "@nestjs/common"
import { HttpSecurityError, HttpSecurityErrorCode } from "./errors/http-security.error"
import type { WebhookProof, WebhookProofRegistry, WebhookProofRequest } from "./webhook-proof.port"

@Injectable()
/** The proofs of the providers whose secrets are stored per scope; modules add theirs once at start. */
export class WebhookProofRegistryService implements WebhookProofRegistry {
    private readonly proofs = new Map<string, WebhookProof>()

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

    /** Enforces the registered proof and retains the shared HTTP security refusal codes. */
    async verify(provider: string, request: WebhookProofRequest): Promise<void> {
        const proof = this.proofs.get(provider)
        if (proof === undefined) {
            return Promise.reject(
                new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookProviderUnknown, params: { provider } }),
            )
        }
        if (!(await proof.prove(request))) {
            throw new HttpSecurityError({ code: HttpSecurityErrorCode.WebhookSignatureInvalid })
        }
    }
}
