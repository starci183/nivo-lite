import { SetContextLink } from "@apollo/client/link/context"
import { GraphQLHeadersKey } from "../../wire"
import { headersOf } from "./headers"

/** Parameters of the locale link. */
export interface CreateAttachLocaleLinkParams {
    /** The name of the cookie that holds the reader locale. */
    localeCookieName: string
}

/** Attaches the reader locale (from the locale cookie) as `Accept-Language`, so every failure comes back localized by the back end. */
export const createAttachLocaleLink = ({ localeCookieName }: CreateAttachLocaleLinkParams): SetContextLink => {
    const localeOfCookie = (): string | undefined => {
        if (typeof document === "undefined") return undefined
        const pair = document.cookie.split("; ").find((entry) => entry.startsWith(`${localeCookieName}=`))
        return pair?.slice(localeCookieName.length + 1)
    }
    return new SetContextLink((previous) => {
        const locale = localeOfCookie()
        return {
            headers: {
                ...(locale === undefined ? {} : { [GraphQLHeadersKey.AcceptLanguage]: locale }),
                ...headersOf(previous.headers),
            },
        }
    })
}
