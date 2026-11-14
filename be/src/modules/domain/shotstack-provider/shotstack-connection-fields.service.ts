import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { SHOTSTACK_API_KEY, SHOTSTACK_ENVIRONMENT } from "./shotstack-credential.service"
import { SHOTSTACK_PROVIDER } from "./shotstack-failure.policy"

/**
 * The connection form of a Shotstack account: its API key (header `x-api-key`, https://shotstack.io/docs/api/), sealed and write-only, and
 * the environment the key was issued for, a public fact: `stage` (sandbox, free renders with a watermark) or `v1` (production, spends
 * credits). Both environments have their own key and base URL (https://shotstack.io/docs/guide/getting-started/request-api-keys/).
 */
export const SHOTSTACK_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: SHOTSTACK_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: SHOTSTACK_API_KEY,
                label: { vi: "API key (Shotstack)", en: "API key (Shotstack)" },
                kind: "secret",
                required: false,
                minLength: 1,
                maxLength: 256,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "stored-secret" },
            },
            {
                key: SHOTSTACK_ENVIRONMENT,
                label: { vi: "M\u00f4i tr\u01b0\u1eddng", en: "Environment" },
                kind: "choice",
                required: true,
                maxLength: null,
                choices: [
                    { value: "stage", label: { vi: "Th\u1eed nghi\u1ec7m (stage, c\u00f3 watermark)", en: "Sandbox (stage, watermarked)" } },
                    {
                        value: "v1",
                        label: { vi: "Ch\u00ednh th\u1ee9c (v1, tr\u1eeb credit)", en: "Production (v1, uses credits)" },
                        confirm: {
                            text: {
                                vi: "M\u00f4i tr\u01b0\u1eddng ch\u00ednh th\u1ee9c d\u00f9ng credit c\u1ee7a Shotstack cho m\u1ed7i video d\u1ef1ng. Ti\u1ebfp t\u1ee5c?",
                                en: "The production environment uses Shotstack credits for every video rendered. Continue?",
                            },
                            key: null,
                        },
                    },
                ],
                source: { kind: "meta", key: SHOTSTACK_ENVIRONMENT },
            },
        ],
    },
]

@Injectable()
/** The connection form writer of a Shotstack account: a new API key is sealed (owner only), the environment is a public fact, the name is renamed. */
export class ShotstackConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a Shotstack account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = SHOTSTACK_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals a new key and stores a new environment (the owner's role proved first), then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const key = change.values[SHOTSTACK_API_KEY]
        const environment = change.values[SHOTSTACK_ENVIRONMENT]
        if (key !== undefined || environment !== undefined) await this.connections.authorize(actor, ["owner"])
        if (key !== undefined) await this.connections.writeSecret(connection.id, JSON.stringify({ [SHOTSTACK_API_KEY]: key }))
        if (environment !== undefined) {
            await this.connections.patch(actor.workspaceId, connection.id, {
                meta: { ...connection.meta, [SHOTSTACK_ENVIRONMENT]: environment },
            })
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
