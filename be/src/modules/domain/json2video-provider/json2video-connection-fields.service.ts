import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { JSON2VIDEO_API_KEY } from "./json2video-credential.service"
import { JSON2VIDEO_PROVIDER } from "./json2video-failure.policy"

/**
 * The connection form of a JSON2Video account: its API key (header `x-api-key`, https://json2video.com/docs/v2/reference/api-endpoints/movies-create),
 * sealed and write-only. The docs name no environment or region to choose: the API has one base, so there is no public field.
 */
export const JSON2VIDEO_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: JSON2VIDEO_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: JSON2VIDEO_API_KEY,
                label: { vi: "API key (JSON2Video)", en: "API key (JSON2Video)" },
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
/** The connection form writer of a JSON2Video account: a new API key is sealed (owner only), the name is renamed. */
export class Json2VideoConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a JSON2Video account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = JSON2VIDEO_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals a new key (the owner's role proved first), then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const key = change.values[JSON2VIDEO_API_KEY]
        if (key !== undefined) {
            await this.connections.authorize(actor, ["owner"])
            await this.connections.writeSecret(connection.id, JSON.stringify({ [JSON2VIDEO_API_KEY]: key }))
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
