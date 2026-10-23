import { SetContextLink } from "@apollo/client/link/context"
import { LOCALE_COOKIE } from "@/modules/i18n"
import { GraphQLHeadersKey } from "../../types"
import { headersOf } from "./headers-of"

const localeOfCookie = (): string | undefined => {
    if (typeof document === "undefined") return undefined
    const pair = document.cookie.split("; ").find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`))
    return pair?.slice(LOCALE_COOKIE.length + 1)
}

/** Attaches the reader locale (from the locale cookie) as `Accept-Language`, so every failure comes back localized by the back end. */
export const createAttachLocaleLink = () =>
    new SetContextLink((previous) => {
        const locale = localeOfCookie()
        return {
            headers: {
                ...(locale === undefined ? {} : { [GraphQLHeadersKey.AcceptLanguage]: locale }),
                ...headersOf(previous.headers),
            },
        }
    })
