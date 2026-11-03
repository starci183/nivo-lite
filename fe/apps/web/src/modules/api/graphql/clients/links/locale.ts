import { SetContextLink } from "@apollo/client/link/context"
import { i18n } from "@/modules/i18n"
import { GraphQLHeadersKey } from "../../types"
import { headersOf } from "./headers-of"

const localeOfCookie = (): string | undefined => {
    if (typeof document === "undefined") return undefined
    const pair = document.cookie.split("; ").find((entry) => entry.startsWith(`${i18n.localeCookieName}=`))
    return pair?.slice(i18n.localeCookieName.length + 1)
}

/** Attaches the reader locale (from the locale cookie) as `Accept-Language`, so every failure comes back localized by the back end. */
export const createAttachLocaleLink = (): SetContextLink =>
    new SetContextLink((previous) => {
        const locale = localeOfCookie()
        return {
            headers: {
                ...(locale === undefined ? {} : { [GraphQLHeadersKey.AcceptLanguage]: locale }),
                ...headersOf(previous.headers),
            },
        }
    })
