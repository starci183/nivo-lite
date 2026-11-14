import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { CREATOMATE_PROVIDER } from "./creatomate-failure.policy"

/** The credential member of a Creatomate connection's sealed secret (`{ "apiKey": "…" }`), sent as `Authorization: Bearer <key>`. */
export const CREATOMATE_API_KEY = "apiKey"

/** The API key in a sealed secret's plain text, or null when it holds none. */
export const creatomateKeyOf = (plain: string): string | null => {
    const read = parseJsonText(plain)
    const key = read.ok && isRecord(read.value) ? read.value[CREATOMATE_API_KEY] : undefined
    return typeof key === "string" && key.trim() !== "" ? key.trim() : null
}

@Injectable()
/** The API key of one Creatomate account, opened from its sealed secret; an account of another provider or without a key sends nothing. */
export class CreatomateCredentialService {
    constructor(private readonly connections: ConnectionsService) {}

    /** The account API key; `no_credential` (proved `not_sent`) when it has none or is no Creatomate account. */
    async keyOf(connection: ConnectionRecord): Promise<string> {
        const provider: string = connection.provider
        const secret = provider === CREATOMATE_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const key = secret === null ? null : creatomateKeyOf(secret.plain)
        if (key === null) throw withProof(providerRefusal(CREATOMATE_PROVIDER, "no_credential"), "not_sent")
        return key
    }
}
