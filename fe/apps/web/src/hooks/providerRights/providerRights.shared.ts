import { PROVIDER_LOGO, PROVIDERS, isProvider } from "@/hooks/connection-providers"
import type { AbilityMode, AbilityWire, HeldAbilityWire, OnMode, ProviderGroupKind } from "@/modules/providerRights"

/** A label in both reader languages. */
interface BilingualLabel {
    readonly vi: string
    readonly en: string
}

/** The words of a bilingual label in the reader language (Vietnamese, else English). */
export const pickLabel = (label: BilingualLabel, locale: string): string =>
    locale === "vi" ? label.vi : label.en

/** The order the groups of providers are drawn in. */
export const PROVIDER_KINDS: ReadonlyArray<ProviderGroupKind> = ["messaging", "payment", "books"]

/** The name a provider goes by in the shop's words ("Zalo OA", not the brand "Zalo"). */
export const providerNameOf = (provider: string): string => {
    if (!isProvider(provider)) return provider
    return provider === "zalo_oa" ? "Zalo OA" : PROVIDERS[provider].brand
}

/** The logo of a provider, when it has one. */
export const providerLogoOf = (provider: string): string | undefined => (isProvider(provider) ? PROVIDER_LOGO[provider] : undefined)

/** The mode a write ability takes when it is turned on and had none: ask. */
const DEFAULT_ON_MODE: OnMode = "ask"

/** The mode an attachment holds on an ability; `off` when it is not listed. */
export const modeOfAbility = (held: ReadonlyArray<HeldAbilityWire>, id: string): AbilityMode => {
    const mode = held.find((entry) => entry.id === id)?.mode
    return mode === "auto" || mode === "ask" ? mode : "off"
}

/** The mode a tick takes when it is turned on: a read ability is `auto`; a write one keeps `previous` or asks. */
export const onModeOf = (ability: AbilityWire, previous: AbilityMode): OnMode => {
    if (ability.scope === "read") return "auto"
    return previous === "auto" || previous === "ask" ? previous : DEFAULT_ON_MODE
}

/** Narrows a text to a mode of a tick that is on. */
export const isOnMode = (value: string): value is OnMode => value === "auto" || value === "ask"
