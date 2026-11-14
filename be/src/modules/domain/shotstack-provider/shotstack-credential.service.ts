import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { SHOTSTACK_ENVIRONMENTS, type ShotstackEnvironment } from "@modules/integrations/shotstack"
import { SHOTSTACK_PROVIDER } from "./shotstack-failure.policy"

/** The credential member of a Shotstack connection's sealed secret (`{ "apiKey": "…" }`), sent as header `x-api-key`. */
export const SHOTSTACK_API_KEY = "apiKey"

/** The public fact of a Shotstack connection naming the environment its key belongs to: `stage` (sandbox) or `v1` (production). */
export const SHOTSTACK_ENVIRONMENT = "environment"

/** The API key in a sealed secret's plain text, or null when it holds none. */
export const shotstackKeyOf = (plain: string): string | null => {
    const read = parseJsonText(plain)
    const key = read.ok && isRecord(read.value) ? read.value[SHOTSTACK_API_KEY] : undefined
    return typeof key === "string" && key.trim() !== "" ? key.trim() : null
}

/**
 * The environment of an account: its `meta.environment` when it is one of the two the docs name; anything else is the sandbox `stage`
 * (free, watermarked), never the production `v1` that spends credits.
 */
export const shotstackEnvironmentOf = (connection: ConnectionRecord): ShotstackEnvironment => {
    const named = connection.meta[SHOTSTACK_ENVIRONMENT]
    return SHOTSTACK_ENVIRONMENTS.find((environment) => environment === named) ?? "stage"
}

@Injectable()
/** The API key of one Shotstack account, opened from its sealed secret; an account of another provider or without a key sends nothing. */
export class ShotstackCredentialService {
    constructor(private readonly connections: ConnectionsService) {}

    /** The account's API key; `no_credential` (proved `not_sent`) when it has none or is no Shotstack account. */
    async keyOf(connection: ConnectionRecord): Promise<string> {
        const provider: string = connection.provider
        const secret = provider === SHOTSTACK_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const key = secret === null ? null : shotstackKeyOf(secret.plain)
        if (key === null) throw withProof(providerRefusal(SHOTSTACK_PROVIDER, "no_credential"), "not_sent")
        return key
    }
}
