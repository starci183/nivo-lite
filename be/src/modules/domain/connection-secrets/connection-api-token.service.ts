import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ConnectionSecretsService } from "./connection-secrets.service"
import type { OptionalApiToken } from "./connection-secrets.contracts"
import { ConnectionSecretEntity } from "./persistence/entities"

@Injectable()
/**
 * The API token a connection presents to its provider to read the provider's data (a bank feed poll), kept beside the credential the
 * provider sends to NIVO. It is sealed with the same connection key and never returned by a read model.
 */
export class ConnectionApiTokenService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly secrets: ConnectionSecretsService,
    ) {}

    /** Seals and stores the token of a connection that already has its secret row; answers false when it has none. */
    async write(connectionId: string, token: string): Promise<boolean> {
        const updated = await this.entityManager.update(
            ConnectionSecretEntity,
            { connectionId },
            { apiTokenCiphertext: this.secrets.seal(token) },
        )
        return (updated.affected ?? 0) > 0
    }

    /** The opened token, or null when the connection has none or it cannot be opened with the current key. */
    async read(connectionId: string): Promise<OptionalApiToken> {
        const row = await this.entityManager.findOne(ConnectionSecretEntity, {
            select: { apiTokenCiphertext: true },
            where: { connectionId },
        })
        if (row?.apiTokenCiphertext === undefined || row.apiTokenCiphertext === null) return null
        const opened = this.secrets.open(row.apiTokenCiphertext)
        return opened.kind === "ok" ? opened.value : null
    }

    /** Whether the connection holds a token; the token itself stays sealed. */
    async has(connectionId: string): Promise<boolean> {
        const row = await this.entityManager.findOne(ConnectionSecretEntity, {
            select: { apiTokenCiphertext: true },
            where: { connectionId },
        })
        return row?.apiTokenCiphertext !== undefined && row.apiTokenCiphertext !== null
    }
}
