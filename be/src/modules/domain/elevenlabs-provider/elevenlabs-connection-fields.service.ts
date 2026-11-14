import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { ELEVENLABS_API_KEY } from "./elevenlabs-credential.service"
import { ELEVENLABS_PROVIDER } from "./elevenlabs-failure.policy"

/**
 * The connection form of an ElevenLabs account: its API key (header `xi-api-key`, https://elevenlabs.io/docs/api-reference/authentication),
 * sealed and write-only. A key may be restricted at ElevenLabs by scope, credit quota and IP allow-list (a call from an address not
 * allowed is answered 403, refused `auth_refused`).
 */
export const ELEVENLABS_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: ELEVENLABS_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: ELEVENLABS_API_KEY,
                label: { vi: "API key", en: "API key" },
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
/** The connection form writer of an ElevenLabs account: a new API key is sealed as the account's secret (owner only); the name is renamed. */
export class ElevenLabsConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of an ElevenLabs account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = ELEVENLABS_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals a new API key when one is given (the owner's role proved first), then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const key = change.values[ELEVENLABS_API_KEY]
        if (key !== undefined) {
            await this.connections.authorize(actor, ["owner"])
            await this.connections.writeSecret(connection.id, JSON.stringify({ [ELEVENLABS_API_KEY]: key }))
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
