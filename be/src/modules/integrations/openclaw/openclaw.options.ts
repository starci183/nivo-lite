import type { Secret } from "@modules/platform/config"

/** How this process authenticates to the gateway: one shared token or one shared password. */
export type OpenclawAuth =
    { readonly kind: "token"; readonly token: Secret } | { readonly kind: "password"; readonly password: Secret }

/** Where the gateway listens and how to log in. */
export interface OpenclawGatewayOptions {
    /** The ws or wss address of the gateway. */
    readonly url: string
    /** The shared credential, sent in the first frame only. */
    readonly auth: OpenclawAuth
}

/** OpenClaw configuration parsed once at boot. */
export interface OpenclawOptions {
    /** Null when OpenClaw is not configured: every chat turn takes the direct-model fallback. */
    readonly gateway: OpenclawGatewayOptions | null
    /** How long one turn may take, ms. */
    readonly turnTimeoutMs: number
    /** After a first assistant text that is not final, how long to wait for a better one, ms. */
    readonly settleMs: number
    /** The directory with openclaw.json and the agent workspaces, as this process sees the shared volume. */
    readonly configDir: string | undefined
    /** The same directory as the gateway sees it: the workspace paths written into openclaw.json use this one. */
    readonly gatewayStateDir: string
    /** Registers synced agents in openclaw.json; needs the config directory. */
    readonly manageAgents: boolean
    /** The secret that signs the per-job tool tokens; null disables the tool bridge. */
    readonly toolSecret: Secret | null
}
