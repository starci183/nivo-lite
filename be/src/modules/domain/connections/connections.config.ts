import type { EnvSource } from "@modules/platform/config"
import { decodeChannelKey } from "./connection-cipher.policy"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"

/** Reads the connections configuration: the credential key is required and must be 32 bytes in base64. */
export const parseConnectionsConfig = (env: EnvSource): ConnectionsOptions => {
    const channelTokenKey = env.secret("CHANNEL_TOKEN_KEY")
    if (decodeChannelKey(channelTokenKey.reveal()) === null) {
        throw new ConnectionsError({ code: ConnectionsErrorCode.KeyInvalid })
    }
    return { channelTokenKey, publicSiteUrl: env.optional("PUBLIC_SITE_URL") }
}
