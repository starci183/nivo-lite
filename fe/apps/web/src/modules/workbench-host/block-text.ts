import type { SpecLocale, SpecText } from "@nivo-lite/agent-sdk/schema"

/** The words a spec text says in the viewer language: a key goes through the catalogue translator, inline words pick the locale. */
export const spokenText = (translate: (key: string) => string, locale: SpecLocale, text: SpecText): string =>
    "key" in text ? translate(text.key) : text[locale]

/** The spec locale of an app locale; Vietnamese for any language the specs have no words in. */
export const specLocaleOf = (locale: string): SpecLocale => (locale === "en" ? "en" : "vi")
