import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { BillingLogEvent } from "./billing.log-events"
import { InjectBillingOptions } from "./billing.decorators"
import type { BillingOptions } from "./billing.options"
import { decryptSecret } from "./channel-secret.policy"
import type { ConnectionSecretRow } from "./persistence/bank-feed.rows"
import { SELECT_CONNECTION_SECRET } from "./persistence/bank-feed.sql"

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
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectBillingOptions() private readonly options: BillingOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /**
     * The secrets of a connection of `provider`, or null when the id is not a connection id, the connection is missing, belongs to
     * another provider, is disconnected, has no secret row or its credential cannot be decrypted (that last case is logged).
     */
    async load(connectionId: string, provider: string): Promise<PaymentSecretLookup> {
        if (!UUID.test(connectionId)) return null
        const [row] = await this.entityManager.query<Array<ConnectionSecretRow>>(SELECT_CONNECTION_SECRET, [
            connectionId,
        ])
        if (row === undefined || row.provider !== provider || row.status === "disconnected") return null
        try {
            const credential = decryptSecret(row.ciphertext, this.options.channelTokenKey?.reveal())
            return { workspaceId: row.workspace_id, credential, webhookSecret: row.webhook_secret }
        } catch (cause) {
            this.logger.error(BillingLogEvent.CredentialUnreadable, cause, { connectionId })
            return null
        }
    }
}
