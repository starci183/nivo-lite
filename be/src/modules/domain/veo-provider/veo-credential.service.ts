import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionRecord } from "@modules/domain/connections"
import { providerRefusal, withProof } from "@modules/domain/provider-registry"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import { VEO_PROVIDER } from "./veo-failure.policy"

/** The credential member of a Veo connection's sealed secret (`{ "apiKey": "…" }`), sent as header `x-goog-api-key`. */
export const VEO_API_KEY = "apiKey"

/** The public fact of a Veo connection naming the model it generates with: the owner's choice. */
export const VEO_MODEL = "model"

/** The API key in a sealed secret's plain text, or null when it holds none. */
export const veoKeyOf = (plain: string): string | null => {
    const read = parseJsonText(plain)
    const key = read.ok && isRecord(read.value) ? read.value[VEO_API_KEY] : undefined
    return typeof key === "string" && key.trim() !== "" ? key.trim() : null
}

@Injectable()
/** The Gemini API key of one Veo account, opened from its sealed secret; an account of another provider or without a key sends nothing. */
export class VeoCredentialService {
    constructor(private readonly connections: ConnectionsService) {}

    /** The account's API key; `no_credential` (proved `not_sent`) when it has none or is no Veo account. */
    async keyOf(connection: ConnectionRecord): Promise<string> {
        const provider: string = connection.provider
        const secret = provider === VEO_PROVIDER ? await this.connections.readSecret(connection.id) : null
        const key = secret === null ? null : veoKeyOf(secret.plain)
        if (key === null) throw withProof(providerRefusal(VEO_PROVIDER, "no_credential"), "not_sent")
        return key
    }
}
