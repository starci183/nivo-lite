import type { Secret } from "@modules/platform/config"

/** One key of a provider: the name telemetry shows and the secret it stands for. */
export interface AiGatewayKey {
    /** The name of the key in logs and health: the env name it came from; never the secret. */
    readonly alias: string
    /** The key itself, read once at boot (a `<KEY>_FILE` mount included). */
    readonly secret: Secret
}

/** One OpenAI-compatible upstream endpoint of the pool: where it is and the keys that reach it. */
export interface AiGatewayProvider {
    /** The provider id in the router: `upstream` or `embeddings`. */
    readonly id: string
    /** The base URL the OpenAI paths hang from, without a trailing slash. */
    readonly baseUrl: string
    /** The keys; never empty for a provider that is kept. */
    readonly keys: ReadonlyArray<AiGatewayKey>
}

/** The upstream models the two profiles stand for. */
export interface AiGatewayModels {
    /** The model behind the `work` profile (chat). */
    readonly work: string
    /** The model behind the `embed` profile (embeddings). */
    readonly embed: string
}

/** A virtual key mounted from a sealed secret: the gateway keeps only its hash, nothing is written to the key store. */
export interface AiGatewayMountedKey {
    /** The key label; the secret starts with `sk-starci-<label>-`. */
    readonly label: string
    /** The virtual key itself, read once at boot (a `<KEY>_FILE` mount included). */
    readonly secret: Secret
    /** The profiles the key may call. */
    readonly profiles: ReadonlyArray<string>
}

/** The gateway: the OpenAI-compatible front of the pool that runs inside this process. */
export interface AiGatewayHost {
    /** Where the SQLite file of the virtual keys lives. */
    readonly keysPath: string
    /** The token of the admin API (key issue, rotate, revoke); null turns the admin API off. */
    readonly adminToken: Secret | null
    /** The virtual keys mounted from sealed secrets, so a deploy issues no key by hand. */
    readonly mountedKeys: ReadonlyArray<AiGatewayMountedKey>
}

/** The AI pool: the upstream providers, the models behind the profiles and the gateway. */
export interface AiGatewayOptions {
    /** The upstream providers that hold a key; empty means neither router nor gateway is registered. */
    readonly providers: ReadonlyArray<AiGatewayProvider>
    /** The models the profiles stand for. */
    readonly models: AiGatewayModels
    /** The gateway, or null for a process that only calls it (the CLI) or has no upstream key. */
    readonly gateway: AiGatewayHost | null
}
