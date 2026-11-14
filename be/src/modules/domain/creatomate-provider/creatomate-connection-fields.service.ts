import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { CREATOMATE_API_KEY } from "./creatomate-credential.service"
import { CREATOMATE_PROVIDER } from "./creatomate-failure.policy"

/**
 * The connection form of a Creatomate account: its project API key (sent as `Authorization: Bearer <key>`,
 * https://creatomate.com/llms/quick-start.md), sealed and write-only. Nothing else is a field: the docs name no environment or region,
 * and the webhook secret is the connection own.
 */
export const CREATOMATE_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: CREATOMATE_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: CREATOMATE_API_KEY,
                label: { vi: "API key (Creatomate)", en: "API key (Creatomate)" },
                kind: "secret",
                required: false,
                minLength: 1,
                maxLength: 256,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "stored-secret" },
            },
        ],
    },
]

@Injectable()
/** The connection form writer of a Creatomate account: a new API key is sealed (owner only), the name is renamed. */
export class CreatomateConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a Creatomate account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = CREATOMATE_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals a new key (the owner role proved first), then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const key = change.values[CREATOMATE_API_KEY]
        if (key !== undefined) {
            await this.connections.authorize(actor, ["owner"])
            await this.connections.writeSecret(connection.id, JSON.stringify({ [CREATOMATE_API_KEY]: key }))
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
