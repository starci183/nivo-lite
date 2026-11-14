import { z } from "../schema/zod-entry"
import { crmProviderKeyOf } from "./crm"
import type { ProviderKey } from "./index"

/** The key of every core provider a workspace may connect. A CRM's key (`crm.<crmId>`) is `PROVIDER.crm(id)`, declared by its generated names file. */
const CORE_PROVIDER = {
    /** NIVO itself: its own tools (the CRM of the shop, the team chat, the brain) need no connected account; always bound. */
    nivo: "nivo",
    zaloOa: "zalo_oa",
    telegram: "telegram",
    meta: "meta",
    sepay: "sepay",
    casso: "casso",
    payos: "payos",
    smtp: "smtp",
    imap: "imap",
    google: "google",
    googleDrive: "google_drive",
    /** A domain registrar (iNET): it serves the generic domain purposes (`nivo.tool.domain.*`). */
    inet: "inet",
    /** A domain registrar (Tino): it serves the generic domain purposes (`nivo.tool.domain.*`). */
    tino: "tino",
    /** A speech and dubbing service (ElevenLabs): it serves `nivo.tool.speech.*` and `nivo.tool.dubbing.*`. */
    elevenlabs: "elevenlabs",
    /** A video generation service (Google Veo): it serves `nivo.tool.video.generate` and `nivo.tool.video.generation.get`. */
    veo: "veo",
    /** A short-video destination (TikTok): it serves `nivo.tool.tiktok.*` (direct post of a video, its status, the account's limits). */
    tiktok: "tiktok",
    /** A cloud video compose service (Shotstack): it serves `nivo.tool.video.compose` and `nivo.tool.video.render.get`. */
    shotstack: "shotstack",
    /** A cloud video compose service (Creatomate): it serves `nivo.tool.video.compose` and `nivo.tool.video.render.get`. */
    creatomate: "creatomate",
    /** A cloud video compose service (JSON2Video): it serves `nivo.tool.video.compose` and `nivo.tool.video.render.get`. */
    json2video: "json2video",
    /** An accounting system (MISA AMIS): connectable; it serves no purpose until an adapter is built from its documentation. */
    misaAmis: "misa_amis",
    /** An e-invoice service (MISA meInvoice): connectable; it serves no purpose until an adapter is built from its documentation. */
    misaMeinvoice: "misa_meinvoice",
} as const

/** The core provider keys, and `crm(id)`: the key of a CRM (`crm.nivoweb`), typed only when a generated names file declares it. */
export interface ProviderConstants extends Readonly<typeof CORE_PROVIDER> {
    /** The provider key of the CRM `crmId` (`PROVIDER.crm("nivoweb")` is `crm.nivoweb`); never enumerated with the core keys. */
    readonly crm: <Id extends string>(crmId: Id) => Extract<ProviderKey, `crm.${Id}`>
}

/** The provider key of the CRM `crmId`, typed as the key a generated names file declares for it (`crm.<crmId>`). */
function crmKeyOf<Id extends string>(crmId: Id): Extract<ProviderKey, `crm.${Id}`>
function crmKeyOf(crmId: string): string {
    return crmProviderKeyOf(crmId)
}

/**
 * The key of every provider a workspace may connect: the core keys as members, and `crm(id)` for a CRM. `crm` is not enumerable, so
 * `Object.values(PROVIDER)` is the core keys alone.
 */
export const PROVIDER: ProviderConstants = { ...CORE_PROVIDER, crm: crmKeyOf }
Object.defineProperty(PROVIDER, "crm", { enumerable: false, writable: false, configurable: false })

/** Compiles only when every value is a declared name: a constant whose id is not a key of the names interface is a compile error. */
type Declared<T extends Readonly<Record<string, ProviderKey>>> = T

/** The name of one core provider constant. */
export type CoreProviderConstant = keyof Declared<typeof CORE_PROVIDER>

/**
 * The schema of a provider key: one of the core keys (`PROVIDER`) or of the source keys given (each generated names file exports its own,
 * `CRM_PROVIDER`), built when it is called. The augmentation of `ProviderNames` by a source's names file is a TYPE only, gone at run time;
 * its runtime twin is the `<KEY>_PROVIDER` constant the same file exports, so a caller that sees a source's names passes that constant
 * here, and a key nobody passed is refused. Typed `ProviderKey`: a key not declared in the caller's program does not compile.
 */
export const providerKeySchema = (sources: ReadonlyArray<ProviderKey> = []): z.ZodType<ProviderKey> => {
    const keys = new Set<string>([...Object.values(CORE_PROVIDER), ...sources])
    return z.string().refine((value): value is ProviderKey => keys.has(value), { message: "not a declared provider key" })
}
