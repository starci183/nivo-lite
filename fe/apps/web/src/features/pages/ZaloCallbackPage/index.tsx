import { ZaloCallbackPageBase } from "./component"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
interface ZaloCallbackPageProps {
    readonly code?: string | undefined
    readonly oaId?: string | undefined
    readonly state?: string | undefined
}

/**
 * Where Zalo sends the browser: the state names the connection and carries a one-time nonce. The connected block hands it to the back end
 * (which proves the signed-in member may connect it and queues the PKCE exchange); the browser always lands back on Connections.
 */
export const ZaloCallbackPage = (props: ZaloCallbackPageProps) => (
    <ZaloCallbackPageBase props={{ code: props.code, oaId: props.oaId, state: props.state }} />
)
