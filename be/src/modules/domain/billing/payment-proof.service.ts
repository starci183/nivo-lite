import { Injectable } from "@nestjs/common"
import { InjectBillingOptions } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import type {
    CassoDelivery,
    HeaderValue,
    PayosDelivery,
    PayosProof,
    ProvenDelivery,
    SepayFeedDelivery,
} from "./billing.contracts"
import { isCassoAuthentic } from "./casso.policy"
import { sameText, sha256Hex } from "./channel-secret.policy"
import { PaymentSecretsService } from "./payment-secrets.service"
import { BillingError, BillingErrorCode } from "./errors/billing.error"
import { isPayosAuthentic, isPayosSample, payosBodyOf } from "./payos.policy"
import { isValidApiKey, presentedApiKey } from "./sepay.policy"
import { parseJsonObject } from "./webhook-body.policy"

const unauthorized = (cause?: unknown): BillingError =>
    new BillingError({ code: BillingErrorCode.WebhookUnauthorized, cause })

@Injectable()
/**
 * The proof of every payment webhook, each in the scheme its provider documents. An intake calls exactly one of these as its first
 * statement and goes on only when it returned: a refusal is an `unauthenticated` error, never a partial answer. The comparisons of
 * keys, signatures and digests are constant-time, and a door whose secret is not configured refuses everything.
 */
export class PaymentProofService {
    constructor(
        @InjectBillingOptions() private readonly options: BillingOptions,
        private readonly secrets: PaymentSecretsService,
    ) {}

    /** NIVO's own billing feed from SePay: `Authorization: Apikey <SEPAY_WEBHOOK_API_KEY>`. */
    verifyBillingKey(authorization: HeaderValue): void {
        if (!isValidApiKey(authorization, this.options.sepayApiKey?.reveal())) throw unauthorized()
    }

    /** The simulated bank: the `x-nivo-bank-secret` header equals the configured secret. */
    verifySimulatedBank(secret: HeaderValue): void {
        const wanted = this.options.simulatedBank.secret?.reveal()
        if (wanted === undefined || secret === undefined || !sameText(secret, wanted)) throw unauthorized()
    }

    /**
     * A workspace's own Casso feed. Webhook V2 signs the sorted body with HMAC-SHA512 under the integration key; webhook V1 sends
     * that key as `secure-token`. The body is parsed from the raw bytes the sender signed.
     */
    async proveCasso(delivery: CassoDelivery): Promise<ProvenDelivery> {
        const body = parseJsonObject(delivery.rawBody)
        const connection = await this.secrets.load(delivery.connectionId, "casso")
        if (connection === null) throw unauthorized()
        const key = this.credentialKey(connection.credential, "secureKey")
        if (!isCassoAuthentic({ body, signature: delivery.signature, secureToken: delivery.secureToken, key })) {
            throw unauthorized()
        }
        return { connection: { connectionId: delivery.connectionId, workspaceId: connection.workspaceId }, body }
    }

    /**
     * A workspace's own payOS feed. The `signature` is HMAC-SHA256 under the checksum key of the channel over the sorted `data`
     * fields. The confirmation ping of payOS (a sample order) is recognised before the signature and acknowledged without being
     * booked.
     */
    async provePayos(delivery: PayosDelivery): Promise<PayosProof> {
        const body = parseJsonObject(delivery.rawBody)
        const connection = await this.secrets.load(delivery.connectionId, "payos")
        const payos = payosBodyOf(body)
        if (connection === null || !payos.data) throw unauthorized()
        if (isPayosSample(payos.data)) return { kind: "sample" }
        if (!isPayosAuthentic(payos, this.credentialKey(connection.credential, "checksumKey"))) throw unauthorized()
        return {
            kind: "proven",
            connection: { connectionId: delivery.connectionId, workspaceId: connection.workspaceId },
            body,
        }
    }

    /** A workspace's own SePay feed: `Authorization: Apikey <key>` whose SHA-256 equals the stored webhook secret of the connection. */
    async proveSepayFeed(delivery: SepayFeedDelivery): Promise<ProvenDelivery> {
        const presented = presentedApiKey(delivery.authorization)
        if (presented === undefined) throw unauthorized()
        const connection = await this.secrets.load(delivery.connectionId, "sepay")
        if (connection === null || !sameText(sha256Hex(presented), connection.webhookSecret)) throw unauthorized()
        return {
            connection: { connectionId: delivery.connectionId, workspaceId: connection.workspaceId },
            body: parseJsonObject(delivery.rawBody),
        }
    }

    /** One text key of a connection credential; a credential that is not a JSON object, or lacks the key, proves nothing. */
    private credentialKey(credential: string, name: string): string {
        try {
            const key = parseJsonObject(Buffer.from(credential))[name]
            return typeof key === "string" ? key : ""
        } catch (cause) {
            throw unauthorized(cause)
        }
    }
}
