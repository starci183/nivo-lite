/**
 * Compatibility view of the connection provider registry for the lanes that still read the old `{ vi, en }` shapes (agent dashboard,
 * channels, data hub, the provider wizards). The registry itself is data in `hooks/connection-providers` and
 * `hooks/connection-guides`; every word is a key of the `connections` catalog, and this file reads that catalog (both languages)
 * to rebuild the old shapes. Wave 3 deletes it when the last importer reads the registry and the catalog directly.
 */
import { GUIDES, guideKey, VERIFY, verifyKey } from "@/hooks/connection-guides"
import type { GuideItemDef } from "@/hooks/connection-guides"
import { PROVIDER_GROUPS as GROUPS, PROVIDERS as REGISTRY, providerKey } from "@/hooks/connection-providers"
import en from "@/modules/i18n/messages/en/connections.json"
import vi from "@/modules/i18n/messages/vi/connections.json"
import type { Environment, Provider, ProviderGroupId, ProviderKind } from "@/modules/types"

export type { Environment, Provider }
export type { GuideContext, Token } from "@/hooks/connection-guides"
export { fill, tokenValue } from "@/hooks/connection-guides"
export { PROVIDER_LOGO } from "@/hooks/connection-providers"

/** A text in both languages. */
export type L = { readonly vi: string; readonly en: string }

/** The languages of the product. */
export type Locale = keyof L

/** One line of a provider screen: copy a value, make a choice, switch something on, paste a provider value into NIVO, or a plain note. */
export type GuideItem =
    | {
          readonly kind: "copy"
          readonly label: string
          readonly token: "webhookName" | "webhookUrl" | "apiKey" | "callbackUrl"
          readonly secret?: boolean
      }
    | { readonly kind: "choose"; readonly label: string; readonly option: string }
    | { readonly kind: "switch"; readonly label: string; readonly state: L }
    | {
          readonly kind: "paste"
          readonly label: string
          readonly field: string
          readonly secret?: boolean
          readonly hint?: L
      }
    | { readonly kind: "note"; readonly text: L }

/** One screen of the provider guide: its title as the provider prints it and its lines. */
export type GuideStep = { readonly id: string; readonly title: string; readonly items: ReadonlyArray<GuideItem> }

/** How the owner proves the connection works: an intro, the steps and an optional link. */
export type VerifyHelp = { readonly intro: L; readonly steps: ReadonlyArray<L>; readonly url?: string }

/** One provider with its copy in both languages (the old shape of the registry). */
export type ProviderDef = {
    readonly id: Provider
    readonly kind: ProviderKind
    readonly title: L
    readonly brand: string
    readonly blurb: L
    readonly module: "accounting" | "chatbot" | null
    readonly earlyAccess?: boolean
    readonly environments: ReadonlyArray<Environment>
    readonly noTestNote?: L
    readonly needsBank: boolean
    readonly dashboard: Partial<Record<Environment, string>>
    readonly guide: ReadonlyArray<GuideStep>
    readonly credentials: ReadonlyArray<string>
    readonly confirmsWebhook?: boolean
    readonly verify: Partial<Record<Environment, VerifyHelp>>
}

const catalogs: Readonly<Record<Locale, Readonly<Record<string, string>>>> = { vi, en }
const word = (locale: Locale, key: string): string => catalogs[locale][key] ?? key
const both = (key: string): L => ({ vi: word("vi", key), en: word("en", key) })

const itemOf = (provider: Provider, step: string, index: number, item: GuideItemDef): GuideItem => {
    const key = (part: "label" | "option" | "state" | "hint" | "text") => guideKey(provider, step, index, part)
    switch (item.kind) {
        case "copy":
            return {
                kind: "copy",
                label: word("vi", key("label")),
                token: item.token,
                ...(item.secret ? { secret: true } : {}),
            }
        case "choose":
            return { kind: "choose", label: word("vi", key("label")), option: word("vi", key("option")) }
        case "switch":
            return { kind: "switch", label: word("vi", key("label")), state: both(key("state")) }
        case "paste":
            return {
                kind: "paste",
                label: word("vi", key("label")),
                field: item.field,
                ...(item.secret ? { secret: true } : {}),
                ...(item.hasHint ? { hint: both(key("hint")) } : {}),
            }
        default:
            return { kind: "note", text: both(key("text")) }
    }
}

const guideOf = (provider: Provider): ReadonlyArray<GuideStep> =>
    (GUIDES[provider] ?? []).map((step) => ({
        id: step.id,
        title: word("vi", guideKey(provider, step.id, null, "title")),
        items: step.items.map((item, index) => itemOf(provider, step.id, index, item)),
    }))

const verifyOf = (provider: Provider): Partial<Record<Environment, VerifyHelp>> => {
    const help: Partial<Record<Environment, VerifyHelp>> = {}
    for (const environment of ["test", "live"] as const) {
        const def = VERIFY[provider]?.[environment]
        if (def === undefined) continue
        help[environment] = {
            intro: both(verifyKey(provider, environment, null)),
            steps: Array.from({ length: def.steps }, (_, index) => both(verifyKey(provider, environment, index))),
            ...(def.url === undefined ? {} : { url: def.url }),
        }
    }
    return help
}

const definitionOf = (provider: Provider): ProviderDef => {
    const def = REGISTRY[provider]
    return {
        id: def.id,
        kind: def.kind,
        title: both(providerKey(provider, "title")),
        brand: def.brand,
        blurb: both(providerKey(provider, "blurb")),
        module: def.module,
        ...(def.earlyAccess ? { earlyAccess: true } : {}),
        environments: def.environments,
        ...(def.hasNoTestNote ? { noTestNote: both(providerKey(provider, "noTest")) } : {}),
        needsBank: def.needsBank,
        dashboard: def.dashboard,
        guide: guideOf(provider),
        credentials: def.credentials,
        ...(def.confirmsWebhook ? { confirmsWebhook: true } : {}),
        verify: verifyOf(provider),
    }
}

/** Every provider with its titles, blurbs and guide copy in both languages, rebuilt from the registry and the catalog. */
export const PROVIDERS: Readonly<Record<Provider, ProviderDef>> = Object.fromEntries(
    (Object.keys(REGISTRY) as ReadonlyArray<Provider>).map((provider) => [provider, definitionOf(provider)]),
) as Record<Provider, ProviderDef>

/** The Connections page groups providers by what they bring in; order inside a group is the display order. */
export const PROVIDER_GROUPS: ReadonlyArray<{
    readonly id: ProviderGroupId
    readonly providers: ReadonlyArray<Provider>
}> = GROUPS.map((group) => ({ ...group }))
