import { getLocale } from "next-intl/server"
import { writeZaloAuthorizationReturn } from "@/modules/db"
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
 * Where Zalo sends the browser: the state names the connection and carries a one-time nonce. The database proves the signed-in member may connect it
 * and queues the PKCE exchange for the back end, so the connection turns connected a moment later; the browser always lands back on Connections.
 */
export const ZaloCallbackPage = async (props: ZaloCallbackPageProps) => {
    const locale = await getLocale()
    const go = (href: string) => navigation.redirect({ href, locale })
    const state = props.state ?? ""
    if (props.code === undefined || state === "") return go(connectionsHref("denied"))
    const queued = await writeZaloAuthorizationReturn({ state, code: props.code, ...(props.oaId === undefined ? {} : { oaId: props.oaId }) })
    if (queued.kind === "ok") return go(connectionsHref("ok", queued.value))
    return go(connectionsHref(queued.kind === "refused" || queued.kind === "invalid" ? "denied" : "failed", state.split(".")[0]))
}
