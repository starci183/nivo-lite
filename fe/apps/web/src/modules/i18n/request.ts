import { createRequestConfig } from "@nivo-lite/i18n/request"

/** A loaded catalogue module: the messages are its default export. */
const isCatalogue = (value: unknown): value is { readonly default: Record<string, unknown> } =>
    typeof value === "object" && value !== null && "default" in value && typeof value.default === "object"

/** Loads the console's own catalogue of the requested locale; the i18n package resolves the locale and the time zone. */
export default createRequestConfig("web", async (locale) => {
    const loaded: unknown = await import(`./messages/${locale}.json`)
    if (!isCatalogue(loaded)) throw new Error(`The ${locale} catalogue has no messages`)
    return loaded.default
})
