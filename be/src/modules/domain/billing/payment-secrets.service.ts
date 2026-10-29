import { Injectable } from "@nestjs/common"
import { ConnectionSecretsErrorCode } from "@modules/domain/connection-secrets"
import { ConnectionSecretReadsService } from "@modules/domain/connections"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingLogEvent } from "./billing.log-events"

/** A connection's secrets as the proof of its webhook needs them. */
export interface PaymentSecret {
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The decrypted credential (a JSON object of the provider keys). */
    readonly credential: string
    /** The stored webhook secret (the SHA-256 of the API key a SePay feed presents). */
    readonly webhookSecret: string
}

/** The secrets of a connection, or null when they cannot be used. */
export type PaymentSecretLookup = PaymentSecret | null

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

@Injectable()
/** Reads the secrets of one payment connection for the proof of its webhook; nothing about a connection is answered without them. */
export class PaymentSecretsService {
    constructor(
        private readonly connectionSecrets: ConnectionSecretReadsService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * The secrets of a connection of `provider`, or null when the id is not a connection id, the connection is missing, belongs to
     * another provider, is disconnected, has no secret row or its credential cannot be decrypted (that last case is logged).
     */
    async load(connectionId: string, provider: string): Promise<PaymentSecretLookup> {
        if (!UUID.test(connectionId)) return null
        const secret = await this.connectionSecrets.secretOf(connectionId, provider)
        if (secret.kind === "ok") {
            const { workspaceId, credential, webhookSecret } = secret.value
            return { workspaceId, credential, webhookSecret }
        }
        if (secret.code === ConnectionSecretsErrorCode.Unreadable) {
            this.logger.error(BillingLogEvent.Undecryptable, new Error(secret.code), { connectionId })
        }
        return null
    }
}
