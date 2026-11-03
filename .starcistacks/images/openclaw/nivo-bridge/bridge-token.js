import { createHmac } from "node:crypto"

/** Marks the credential of this plugin, which names a session and not a job (the api tells the two apart by it). */
const PREFIX = "bridge."

/** How long a signed credential is accepted, in seconds: one tool call. */
export const TTL_SECONDS = 60

/**
 * The credential of one call: the agent and the session OpenClaw gave this tool (never anything the model wrote), an expiry, and a
 * signature with the shared secret. The secret itself never travels. The api finds the running turn of that session and refuses a call
 * when none runs.
 */
export const signedTokenOf = (secret, agentId, sessionKey, nowSeconds) => {
    const claims = { a: agentId, s: sessionKey, e: nowSeconds + TTL_SECONDS }
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url")
    const mac = createHmac("sha256", secret).update(`${PREFIX}${body}`).digest("base64url")
    return `${PREFIX}${body}.${mac}`
}
