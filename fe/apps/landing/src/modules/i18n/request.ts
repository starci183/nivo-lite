import { createRequestConfig } from "@nivo-lite/i18n/request"

/** A message tree is an object, never a primitive. */
const isCatalogue = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

/** The default export of a catalogue module, read as `unknown` and checked, never trusted as `any`. */
const catalogueOf = (loaded: unknown): Record<string, unknown> => {
    const catalogue = isCatalogue(loaded) ? loaded["default"] : undefined
    if (!isCatalogue(catalogue)) throw new TypeError("A message catalogue module must export its messages as default")
    return catalogue
}

/** Loads the landing's own catalogue of the requested locale; the i18n package resolves the locale and the time zone. */
export default createRequestConfig("landing", async (locale) => catalogueOf(await import(`./messages/${locale}.json`)))
