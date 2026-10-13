import "server-only"
import { getLocale as getIntlLocale, getTranslations } from "next-intl/server"
import { toLocale, type Dict, type Locale, type RawT, type Translate } from "./core"

/** The reader's locale from the request (defaults to Vietnamese). */
export const getLocale = async (): Promise<Locale> => toLocale(await getIntlLocale())

/** Server-side translator for one namespace; compat shim over next-intl's `getTranslations`. */
export const getT = async <T extends Record<string, string>>(dict: Dict<T>): Promise<Translate<T>> => {
    const t = (await getTranslations(dict.ns)) as unknown as RawT
    return (key, vars) => t(key, vars)
}
