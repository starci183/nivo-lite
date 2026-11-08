import { createRequestConfig, type I18nRequestConfig } from "@starci/next-i18n/request"
import { i18n } from "./routing"

/** The landing's own catalogue of the requested locale over the shared stack, which resolves the locale and the time zone. */
const requestConfig: I18nRequestConfig = createRequestConfig(i18n, {
    app: "landing",
    loadMessages: (locale) => import(`./messages/${locale}.json`),
})
export default requestConfig
