import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { JSON2VIDEO_PROVIDER } from "./json2video-failure.policy"

/** The credential member of a JSON2Video connection's sealed secret (`{ "apiKey": "…" }`), sent as header `x-api-key`. */
export const JSON2VIDEO_API_KEY = "apiKey"

/** The API key in a sealed secret's plain text, or null when it holds none. */
export const json2videoKeyOf = (plain: string): string | null => {
    const read = parseJsonText(plain)
    const key = read.ok && isRecord(read.value) ? read.value[JSON2VIDEO_API_KEY] : undefined
    return typeof key === "string" && key.trim() !== "" ? key.trim() : null
}

@Injectable()
/** The API key of one JSON2Video account, opened from its sealed secret; an account of another provider or without a key sends nothing. */
export class Json2VideoCredentialService {
    constructor(private readonly connections: ConnectionsService) {}

    /** The account's API key; `no_credential` (proved `not_sent`) when it has none or is no JSON2Video account. */
    async keyOf(connection: ConnectionRecord): Promise<string> {
        const provider: string = connection.provider
        const secret = provider === JSON2VIDEO_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const key = secret === null ? null : json2videoKeyOf(secret.plain)
        if (key === null) throw withProof(providerRefusal(JSON2VIDEO_PROVIDER, "no_credential"), "not_sent")
        return key
    }
}
