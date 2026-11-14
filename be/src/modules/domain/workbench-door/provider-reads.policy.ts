import { API_CARRIER } from "@nivo-lite/agent-sdk/names"
import { isApiVerb } from "@nivo-lite/agent-sdk/schema"
import type {
    OptionalProviderReadName,
    ProviderReadName,
    InterfaceProviderAnswer,
    InterfaceViewer,
} from "./provider-reads.contracts"
import { providerOfSegment } from "./provider-reads.registry"

/** The OLD spelling of a provider read, `<provider>:<read>` (stored workbench bindings are data and keep it); a module read holds no colon. */
const PROVIDER_READ = /^([a-z][a-z0-9_-]{1,30}):([a-z][a-z0-9.-]{1,100})$/u

/** The index of the provider segment in an API verb: `nivo`, `api`, then the provider (`nivo.api.<provider>.<read>`). */
const API_PROVIDER_SEGMENT = 2

/**
 * The provider read an API verb names (`nivo.api.<segment>.<read>`): a core provider's segment gives that provider and the rest of the
 * verb as its read (`nivo.api.zalo-oa.config` gives `zalo_oa` + `config`, the old `zalo_oa:config`); any other segment is a source's, served
 * by the carrier under the verb itself (`nivo.api.crm.get.customers` gives `openapi` + the verb, the old `openapi:nivo.api.crm.get.customers`).
 * Null for a verb with no read after its provider.
 */
const apiReadNameOf = (verb: string): OptionalProviderReadName => {
    const segments = verb.split(".")
    const segment = segments[API_PROVIDER_SEGMENT] ?? ""
    const read = segments.slice(API_PROVIDER_SEGMENT + 1).join(".")
    if (read === "") return null
    const provider = providerOfSegment(segment)
    return provider === null ? { provider: API_CARRIER, read: verb } : { provider, read }
}

/**
 * The provider read a door call names, by either spelling: the API verb (`nivo.api.sepay.info`, what interfaces write: `API.*`, a
 * generated `<KEY>_API`) or the old `<provider>:<read>` a stored binding may hold (`sepay:info`, `openapi:nivo.api.crm.get.customers`);
 * both resolve to the same provider and read, so the same reader, audit line and stored answer serve them. Null when it names a module
 * read (or a NIVO verb of another level).
 */
export const providerReadNameOf = (name: string): OptionalProviderReadName => {
    if (isApiVerb(name)) return apiReadNameOf(name)
    const match = PROVIDER_READ.exec(name)
    const provider = match?.[1]
    const read = match?.[2]
    return provider === undefined || read === undefined ? null : { provider, read }
}

/**
 * THE PERMISSION SEAM of provider reads. Today every member of the workspace may run every read a provider offers it (owner rule:
 * everyone sees for now). A later permission model changes this one function (and what it is given); nothing else decides.
 */
export const mayReadProvider = (viewer: InterfaceViewer, name: ProviderReadName): boolean =>
    viewer.memberId !== "" && name.provider !== ""

/** How many rows an answer hands a screen: what the audit line of a person's read keeps, never the rows. */
export const rowCountOf = (answer: InterfaceProviderAnswer): number => {
    if (answer.kind === "page") return answer.rows.length
    return answer.kind === "record" ? 1 : 0
}
