import { PROVIDER_LOGO, PROVIDERS, isProvider } from "@/hooks/connection-providers"
import type { ProviderGroupKind } from "@/modules/providerRights"

/** A label in both reader languages. */
interface BilingualLabel {
    readonly vi: string
    readonly en: string
}

/** The words of a bilingual label in the reader language (Vietnamese, else English). */
export const pickLabel = (label: BilingualLabel, locale: string): string => (locale === "vi" ? label.vi : label.en)

/** The order the groups of providers are drawn in; a kind the board sends that is not listed here is drawn after these. */
export const PROVIDER_KINDS: ReadonlyArray<ProviderGroupKind> = ["messaging", "mail", "payment", "books"]

/** The name a provider goes by in the shop's words ("Zalo OA", not the brand "Zalo"). */
const providerNameOf = (provider: string): string => {
    if (!isProvider(provider)) return provider
    return provider === "zalo_oa" ? "Zalo OA" : PROVIDERS[provider].brand
}

/** The logo of a provider, when it has one. */
export const providerLogoOf = (provider: string): string | undefined =>
    isProvider(provider) ? PROVIDER_LOGO[provider] : undefined

/** The name the shop gives a provider in the reader language; the code name when the board does not list it. */
export const providerLabelOf = (
    provider: { readonly provider: string; readonly label: BilingualLabel } | undefined,
    key: string,
    locale: string,
): string => (provider === undefined ? providerNameOf(key) : pickLabel(provider.label, locale))

/** Spaces and one joining mark ("-", "–", "—", "·", ":", "|") left after the provider name is cut from an account label. */
const LEADING_SEPARATOR = /^[\s\-–—·:|]+/u

/**
 * The name of a connected account on its card: "<provider> · <account>" ("SePay · MB ••••5252"). The account label repeats the
 * provider when the connection was named after it ("SePay MB ••••5252", "Google - shop@example.com"); that leading word and the
 * separator after it are dropped so the card names the provider once.
 */
export const accountTitleOf = (providerLabel: string, accountLabel: string | null): string => {
    const label = (accountLabel ?? "").trim()
    const rest = label.toLocaleLowerCase().startsWith(providerLabel.toLocaleLowerCase())
        ? label.slice(providerLabel.length).replace(LEADING_SEPARATOR, "")
        : label
    return rest === "" ? providerLabel : `${providerLabel} · ${rest}`
}
