import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, PRODUCT_TIME_ZONE } from "@/modules/i18n/routing"

/** Locales of the app. Vietnamese first (Brand V1.1: Vietnamese first for customer-facing copy). */
export { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES }
export type Locale = (typeof LOCALES)[number]

export const toLocale = (value: string | undefined | null): Locale =>
    value === "en" || value === "vi" ? value : DEFAULT_LOCALE

/**
 * Compat shim for the old dictionaries (deleted in Wave 3). A dict names its next-intl namespace (`messages/<locale>/<ns>.json`) and
 * carries both catalogs for the typed keys and for the few places that translate without a request.
 */
export type Dict<T extends Record<string, string>> = {
    readonly ns: string
    readonly en: T
    readonly vi: { readonly [K in keyof T]: string }
}

/** Define a namespace handle over its two JSON catalogs; Vietnamese must provide every English key. */
export const defineDict = <T extends Record<string, string>>(
    ns: string,
    catalogs: { readonly en: T; readonly vi: { readonly [K in keyof T]: string } },
): Dict<T> => ({ ns, ...catalogs })

export type Translate<T extends Record<string, string>> = (
    key: keyof T & string,
    vars?: Record<string, string | number>,
) => string

/** Build a request-free translator; `{name}` placeholders are replaced from `vars`. Prefer `useT` / `getT`, which go through next-intl. */
export const translator =
    <T extends Record<string, string>>(dict: Dict<T>, locale: Locale): Translate<T> =>
    (key, vars) => {
        const template = (dict[locale] as Record<string, string>)[key] ?? dict.en[key] ?? key
        return vars
            ? template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
            : template
    }

/** Intl locale tag for dates and numbers. */
export const intlLocale = (locale: Locale) => (locale === "vi" ? "vi-VN" : "en-GB")
export const TIME_ZONE = PRODUCT_TIME_ZONE

/** The loosely typed shape of next-intl's translate function that the shims call (keys are checked by `Translate<T>`). */
export type RawT = (key: string, vars?: Record<string, string | number>) => string
