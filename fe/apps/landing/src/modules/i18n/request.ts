import { createRequestConfig } from "@nivo-lite/i18n/request"

/** Loads the landing's own catalogue of the requested locale; the i18n package resolves the locale and the time zone. */
export default createRequestConfig("landing", async (locale) => (await import(`./messages/${locale}.json`)).default)
