import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { VEO_API_KEY, VEO_MODEL } from "./veo-credential.service"
import { VEO_PROVIDER } from "./veo-failure.policy"

/**
 * The connection form of a Veo account: its Gemini API key (header `x-goog-api-key`, https://aistudio.google.com/docs/veo), sealed and
 * write-only, and the model id it generates with, a public fact. The guide lists `veo-3.1-generate-preview`,
 * `veo-3.1-fast-generate-preview`, `veo-3.1-lite-generate-preview` (shut down in the Gemini API on 2026-10-22) and the deprecated
 * `veo-3.0-generate-001`, so the owner names the model the key may use; NIVO hard-codes none.
 */
export const VEO_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: VEO_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: VEO_API_KEY,
                label: { vi: "API key (Gemini API)", en: "API key (Gemini API)" },
                kind: "secret",
                required: false,
                minLength: 1,
                maxLength: 256,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "stored-secret" },
            },
            {
                key: VEO_MODEL,
                label: { vi: "M\u00f4 h\u00ecnh", en: "Model" },
                kind: "text",
                required: true,
                minLength: 1,
                maxLength: 80,
                choices: [],
                source: { kind: "meta", key: VEO_MODEL },
            },
        ],
    },
]

@Injectable()
/** The connection form writer of a Veo account: a new API key is sealed (owner only), the model is a public fact, the name is renamed. */
export class VeoConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a Veo account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = VEO_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals a new key and stores a new model (the owner's role proved first), then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const key = change.values[VEO_API_KEY]
        const model = change.values[VEO_MODEL]
        if (key !== undefined || model !== undefined) await this.connections.authorize(actor, ["owner"])
        if (key !== undefined) await this.connections.writeSecret(connection.id, JSON.stringify({ [VEO_API_KEY]: key }))
        if (model !== undefined) {
            await this.connections.patch(actor.workspaceId, connection.id, { meta: { ...connection.meta, [VEO_MODEL]: model } })
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
