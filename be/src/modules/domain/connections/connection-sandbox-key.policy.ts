import { createHmac } from "node:crypto"

/**
 * The sandbox key of a sandbox account (rulings R58 + R60): HMAC-SHA256 of the account id under the server's channel key, so it is
 * stored nowhere, the same for the account on every read, and the server can sign its own "send this row's webhook" call with it. A
 * webhook call for a sandbox account presents it in `x-nivo-sandbox-key`; it is never a provider credential.
 */
export const sandboxKeyFor = (channelKey: string, connectionId: string): string =>
    `sbx_${createHmac("sha256", channelKey).update(`provider-sandbox:${connectionId}`).digest("base64url")}`
