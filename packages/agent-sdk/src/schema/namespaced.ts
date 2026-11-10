import type { Namespaced, SpecLocale, SpecText } from "./schema.types"

/**
 * `<namespace>.<name>`, `<domain>.<object>.<verb>` or NIVO's own `nivo.<domain>.<object>.<verb>`: two to four kebab-case ASCII parts.
 */
const NAMESPACED = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,3}$/

/** Whether a string is a well-formed registry id. */
export const isNamespaced = (value: string): value is Namespaced => NAMESPACED.test(value)

/** The namespace of an id: the part before the dot. */
export const namespaceOf = (id: Namespaced): string => id.slice(0, id.indexOf("."))

/** A spec text in the viewer's words: a key through the translator, owner-written words in the viewer's language. */
export const wordsOf = (text: SpecText, translate: (key: string) => string, locale: SpecLocale): string =>
    "key" in text ? translate(text.key) : text[locale]
