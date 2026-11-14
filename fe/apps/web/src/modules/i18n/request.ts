import { createRequestConfig, type I18nRequestConfig } from "@starci/next-i18n/request"
import { i18n } from "./routing"
import { catalogWithWorkbench } from "./workbench-messages"

/**
 * The console's own catalogue of the requested locale with the words of the generic workbench laid over it (the blocks and the
 * modules), over the shared stack, which resolves the locale and the time zone.
 */
const requestConfig: I18nRequestConfig = createRequestConfig(i18n, {
    app: "web",
    loadMessages: (locale) => catalogWithWorkbench(import(`./messages/${locale}.json`), locale),
})
export default requestConfig
