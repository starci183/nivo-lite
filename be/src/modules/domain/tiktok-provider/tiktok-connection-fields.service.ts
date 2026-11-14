import { Injectable } from "@nestjs/common"
import type {
    ConnectionFieldChange,
    ConnectionFieldWriter,
    ProviderFieldsDeclaration,
} from "@modules/domain/connection-fields"
import { ConnectionsService, type ConnectionActor, type ConnectionRecord } from "@modules/domain/connections"
import { TIKTOK_ACCESS_TOKEN, TIKTOK_EXPIRES_AT, TIKTOK_REFRESH_TOKEN, tiktokTokensOf } from "./tiktok-credential.service"
import { TIKTOK_PROVIDER } from "./tiktok-failure.policy"

/** The public facts that say a token is sealed (a secret is never read back). */
const ACCESS_SEALED = "accessTokenSealed"
const REFRESH_SEALED = "refreshTokenSealed"

/**
 * The connection form of a TikTok account: the TikTok user's access token and refresh token (scope `video.publish`;
 * https://developers.tiktok.com/doc/oauth-user-access-token-management), both sealed and write-only. The app's own client key and secret
 * are the deployment's (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`), never an account field.
 */
export const TIKTOK_FIELD_DECLARATIONS: ReadonlyArray<ProviderFieldsDeclaration> = [
    {
        provider: TIKTOK_PROVIDER,
        editableBy: ["owner"],
        canTest: false,
        fields: [
            {
                key: TIKTOK_ACCESS_TOKEN,
                label: { vi: "M\u00e3 truy c\u1eadp (access token)", en: "Access token" },
                kind: "secret",
                required: false,
                minLength: 1,
                maxLength: 2048,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "meta-flag", key: ACCESS_SEALED },
            },
            {
                key: TIKTOK_REFRESH_TOKEN,
                label: { vi: "M\u00e3 l\u00e0m m\u1edbi (refresh token)", en: "Refresh token" },
                kind: "secret",
                required: false,
                minLength: 1,
                maxLength: 2048,
                choices: [],
                source: { kind: "none" },
                sealedBy: { kind: "meta-flag", key: REFRESH_SEALED },
            },
        ],
    },
]

@Injectable()
/** The connection form writer of a TikTok account: a new token is sealed beside the one kept (owner only); the name is renamed. */
export class TiktokConnectionFieldsService implements ConnectionFieldWriter {
    /** The form of a TikTok account. */
    readonly declarations: ReadonlyArray<ProviderFieldsDeclaration> = TIKTOK_FIELD_DECLARATIONS

    constructor(private readonly connections: ConnectionsService) {}

    /** Seals the tokens given (the owner's role proved first), keeping the other one; then renames when asked. */
    async write(actor: ConnectionActor, connection: ConnectionRecord, change: ConnectionFieldChange): Promise<void> {
        const access = change.values[TIKTOK_ACCESS_TOKEN]
        const refresh = change.values[TIKTOK_REFRESH_TOKEN]
        if (access !== undefined || refresh !== undefined) {
            await this.connections.authorize(actor, ["owner"])
            const secret = await this.connections.readSecret(connection.id)
            const kept = secret === null ? {} : tiktokTokensOf(secret.plain)
            const next: Record<string, unknown> = {
                ...kept,
                ...(access === undefined ? {} : { [TIKTOK_ACCESS_TOKEN]: access }),
                ...(refresh === undefined ? {} : { [TIKTOK_REFRESH_TOKEN]: refresh }),
            }
            // A typed access token has no known expiry: the stored expiry belongs to the token it described.
            const { [TIKTOK_EXPIRES_AT]: _expiry, ...withoutExpiry } = next
            await this.connections.writeSecret(connection.id, JSON.stringify(access === undefined ? next : withoutExpiry))
            await this.connections.patch(actor.workspaceId, connection.id, {
                meta: {
                    ...connection.meta,
                    ...(access === undefined ? {} : { [ACCESS_SEALED]: "true" }),
                    ...(refresh === undefined ? {} : { [REFRESH_SEALED]: "true" }),
                },
            })
        }
        if (change.displayName !== null) await this.connections.rename(actor, connection.id, change.displayName)
    }
}
