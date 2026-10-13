import { getLocale } from "next-intl/server"
import { getSession } from "@/lib/session"
import { writeZaloAuthorizationReturn } from "@/modules/api/channels/write-zalo-authorization"
import { navigation } from "@/modules/i18n"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
interface ZaloCallbackPageProps {
    readonly code?: string
    readonly oaId?: string
    readonly state?: string
}

/** The Connections address the browser lands on, with the verdict the wizard shows on its check step. */
const connectionsHref = (verdict: string, connectionId?: string): string =>
    `/connections?zalo=${verdict}${connectionId === undefined ? "" : `&id=${connectionId}`}`

/**
 * Where Zalo sends the browser: the state names the connection and carries a one-time nonce, the back end proves the signed-in member may connect it
 * and completes the PKCE exchange. The browser always lands back on Connections.
 */
export const ZaloCallbackPage = async (props: ZaloCallbackPageProps) => {
    const locale = await getLocale()
    const go = (href: string) => navigation.redirect({ href, locale })
    const state = props.state ?? ""
    if (props.code === undefined || state === "") return go(connectionsHref("denied"))
    const session = await getSession()
    const completed = await writeZaloAuthorizationReturn(session.workspace.id, {
        state,
        code: props.code,
        ...(props.oaId === undefined ? {} : { oaId: props.oaId }),
    })
    const connectionId = state.split(".")[0]
    if (completed.kind === "ok") return go(connectionsHref("ok", completed.value.connectionId))
    return go(connectionsHref(completed.kind === "refused" ? "denied" : "failed", connectionId))
}
