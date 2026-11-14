import { API, API_CARRIER, PROVIDER, PROVIDER_API, apiSegmentOf, type CoreApiVerb } from "@nivo-lite/agent-sdk/names"
import type { ProviderReadName } from "./provider-reads.contracts"

/**
 * Who answers a core API read at the door: `info` is the provider's own `infoOf` (an `InterfaceReadProvider` of that key);
 * `config` and `rights` are the registry's (`ProviderRegistryReads`), the same for every catalogued provider.
 */
export type CoreReadKind = "info" | "config" | "rights"

/** The reader of one core API read: the door's provider key and the read inside it (the old spelling `<provider>:<read>`). */
export interface CoreApiRead {
    /** The provider key the door dispatches by (`zalo_oa`, `sepay`, `openapi`). */
    readonly provider: string
    /** Which reader answers. */
    readonly read: CoreReadKind
}

/**
 * THE LEVEL-1 READ REGISTRY of the core providers: TOTAL over the SDK's provider reads `PROVIDER_API` (a verb without a reader does not
 * compile here; a key that is no provider read is refused by the mapped type; the engine's own `API.nivo` operations are no provider
 * read and are served by their own door operations), the way the engine's tool specs are total over `TOOL`. The door serves a core
 * provider's read only through this table (`apiVerbOfRead`): a provider that registered a reader whose read `API` does not name (an
 * `infoOf` of `telegram`) is never reached. A source's reads (`nivo.api.crm.*`) are the carrier's named reads, offered by its pinned
 * document at run time, so they are not in this table.
 */
export const CORE_API_READS: { readonly [V in CoreApiVerb]: CoreApiRead } = {
    [API.zaloOa.config]: { provider: PROVIDER.zaloOa, read: "config" },
    [API.zaloOa.rights]: { provider: PROVIDER.zaloOa, read: "rights" },
    [API.telegram.config]: { provider: PROVIDER.telegram, read: "config" },
    [API.telegram.rights]: { provider: PROVIDER.telegram, read: "rights" },
    [API.meta.config]: { provider: PROVIDER.meta, read: "config" },
    [API.meta.rights]: { provider: PROVIDER.meta, read: "rights" },
    [API.sepay.info]: { provider: PROVIDER.sepay, read: "info" },
    [API.sepay.config]: { provider: PROVIDER.sepay, read: "config" },
    [API.sepay.rights]: { provider: PROVIDER.sepay, read: "rights" },
    [API.casso.config]: { provider: PROVIDER.casso, read: "config" },
    [API.casso.rights]: { provider: PROVIDER.casso, read: "rights" },
    [API.payos.config]: { provider: PROVIDER.payos, read: "config" },
    [API.payos.rights]: { provider: PROVIDER.payos, read: "rights" },
    [API.smtp.config]: { provider: PROVIDER.smtp, read: "config" },
    [API.smtp.rights]: { provider: PROVIDER.smtp, read: "rights" },
    [API.imap.info]: { provider: PROVIDER.imap, read: "info" },
    [API.imap.config]: { provider: PROVIDER.imap, read: "config" },
    [API.imap.rights]: { provider: PROVIDER.imap, read: "rights" },
    [API.google.config]: { provider: PROVIDER.google, read: "config" },
    [API.google.rights]: { provider: PROVIDER.google, read: "rights" },
    [API.inet.config]: { provider: PROVIDER.inet, read: "config" },
    [API.inet.rights]: { provider: PROVIDER.inet, read: "rights" },
    [API.tino.config]: { provider: PROVIDER.tino, read: "config" },
    [API.tino.rights]: { provider: PROVIDER.tino, read: "rights" },
    [API.elevenlabs.config]: { provider: PROVIDER.elevenlabs, read: "config" },
    [API.elevenlabs.rights]: { provider: PROVIDER.elevenlabs, read: "rights" },
    [API.veo.config]: { provider: PROVIDER.veo, read: "config" },
    [API.veo.rights]: { provider: PROVIDER.veo, read: "rights" },
    [API.tiktok.config]: { provider: PROVIDER.tiktok, read: "config" },
    [API.tiktok.rights]: { provider: PROVIDER.tiktok, read: "rights" },
    [API.shotstack.config]: { provider: PROVIDER.shotstack, read: "config" },
    [API.shotstack.rights]: { provider: PROVIDER.shotstack, read: "rights" },
    [API.creatomate.config]: { provider: PROVIDER.creatomate, read: "config" },
    [API.creatomate.rights]: { provider: PROVIDER.creatomate, read: "rights" },
    [API.json2video.config]: { provider: PROVIDER.json2video, read: "config" },
    [API.json2video.rights]: { provider: PROVIDER.json2video, read: "rights" },
    [API.misaAmis.config]: { provider: PROVIDER.misaAmis, read: "config" },
    [API.misaAmis.rights]: { provider: PROVIDER.misaAmis, read: "rights" },
    [API.misaMeinvoice.config]: { provider: PROVIDER.misaMeinvoice, read: "config" },
    [API.misaMeinvoice.rights]: { provider: PROVIDER.misaMeinvoice, read: "rights" },
    [API.openapi.info]: { provider: API_CARRIER, read: "info" },
    [API.openapi.config]: { provider: API_CARRIER, read: "config" },
    [API.openapi.rights]: { provider: API_CARRIER, read: "rights" },
}

/** Every core provider read, in `PROVIDER_API`'s order (the engine's own `API.nivo` operations are served by their own door operations). */
const CORE_VERBS: ReadonlyArray<CoreApiVerb> = Object.values(PROVIDER_API).flatMap((reads): ReadonlyArray<CoreApiVerb> => Object.values(reads))

/** The core verbs by their old spelling (`<provider>:<read>`). */
const VERB_OF_READ: ReadonlyMap<string, CoreApiVerb> = new Map(
    CORE_VERBS.map((verb): [string, CoreApiVerb] => [`${CORE_API_READS[verb].provider}:${CORE_API_READS[verb].read}`, verb]),
)

/** The door's provider key of each core provider segment (`zalo-oa` → `zalo_oa`), by the SDK's one mapping (`apiSegmentOf`). */
const PROVIDER_OF_SEGMENT: ReadonlyMap<string, string> = new Map(
    Object.values(CORE_API_READS).map((entry): [string, string] => [apiSegmentOf(entry.provider), entry.provider]),
)

/** The core API verb of a provider read of either spelling, or null when no core reader serves it (a source's read included). */
export const apiVerbOfRead = (name: ProviderReadName): CoreApiVerb | null => VERB_OF_READ.get(`${name.provider}:${name.read}`) ?? null

/** The door's provider key of a core provider's segment, or null when the segment is a source's (`crm`). */
export const providerOfSegment = (segment: string): string | null => PROVIDER_OF_SEGMENT.get(segment) ?? null
