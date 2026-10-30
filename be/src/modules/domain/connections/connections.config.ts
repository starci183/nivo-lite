import type { EnvSource } from "@modules/platform/config"
import { decodeChannelKey } from "./connection-cipher.policy"
import type { ConnectionsConfig } from "./connections.options"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"

/** Reads the required site URL and credential key, which must be 32 bytes in base64. */
export const parseConnectionsConfig = (env: EnvSource): ConnectionsConfig => {
    const channelTokenKey = env.secret("CHANNEL_TOKEN_KEY")
    if (decodeChannelKey(channelTokenKey.reveal()) === null) {
        throw new ConnectionsError({ code: ConnectionsErrorCode.KeyInvalid })
    }
    return {
        channelTokenKey,
        siteUrl: env.url("SITE_URL"),
        publicSiteUrl: env.optional("PUBLIC_SITE_URL"),
        publicApiUrl: env.optional("PUBLIC_API_URL"),
    }
}
