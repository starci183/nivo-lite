import { PROVIDER_LOGO, PROVIDERS, isProvider } from "@/hooks/connection-providers"
import type { AbilityMode, AbilityWire, AttachmentWire, HeldAbilityWire, OnMode, ProviderKind } from "./providerRights.types"

/** The order the groups of providers are drawn in. */
export const PROVIDER_KINDS: ReadonlyArray<ProviderKind> = ["messaging", "payment", "books"]

/** The name a provider goes by in the shop's words ("Zalo OA", not the brand "Zalo"). */
export const providerNameOf = (provider: string): string => {
    if (!isProvider(provider)) return provider
    return provider === "zalo_oa" ? "Zalo OA" : PROVIDERS[provider].brand
}

/** The logo of a provider, when it has one. */
export const providerLogoOf = (provider: string): string | undefined => (isProvider(provider) ? PROVIDER_LOGO[provider] : undefined)

/** The catalog key of an ability (`qr.create` reads `qr_create`). */
export const abilityKeyOf = (id: string): string => id.replaceAll(".", "_")

/** The mode a write ability takes when it is turned on and had none: Hỏi (`ask`). */
export const DEFAULT_ON_MODE: OnMode = "ask"

/** The mode an attachment holds on an ability; `off` when it is not listed. */
export const modeOfAbility = (held: ReadonlyArray<HeldAbilityWire>, id: string): AbilityMode =>
    held.find((entry) => entry.id === id)?.mode ?? "off"

/** The mode a tick takes when it is turned on: a read ability is `auto`; a write one keeps `previous` or asks. */
export const onModeOf = (ability: AbilityWire, previous: AbilityMode): OnMode => {
    if (ability.scope === "read") return "auto"
    return previous === "auto" || previous === "ask" ? previous : DEFAULT_ON_MODE
}

/** Narrows a text to a mode of a tick that is on. */
export const isOnMode = (value: string): value is OnMode => value === "auto" || value === "ask"

/** The abilities an attachment lists, or none. */
export const heldOf = (attachments: ReadonlyArray<AttachmentWire>, provider: string): ReadonlyArray<HeldAbilityWire> =>
    attachments.find((one) => one.provider === provider)?.abilities ?? []
