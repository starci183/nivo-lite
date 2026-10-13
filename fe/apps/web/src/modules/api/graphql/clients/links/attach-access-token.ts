import { ApolloLink, Observable } from "@apollo/client"
import { sessionAccessToken } from "@/modules/auth"

/** The context of an operation as far as the headers go. */
interface OperationHeaders {
    headers?: object
}

/** Parameters of the access-token link. */
export interface CreateAttachAccessTokenLinkParams {
    /** Where the token comes from; defaults to the Supabase browser session. */
    getToken?: () => Promise<string | undefined>
}

/** Attaches `Authorization: Bearer <access token>` of the Supabase browser session to every operation (none when signed out). */
export const createAttachAccessTokenLink = ({
    getToken = sessionAccessToken,
}: CreateAttachAccessTokenLinkParams = {}) =>
    new ApolloLink(
        (operation, forward) =>
            new Observable((observer) => {
                let subscription: { unsubscribe: () => void } | undefined
                let cancelled = false
                void getToken().then((token) => {
                    if (cancelled) return
                    if (token) {
                        operation.setContext((previous: OperationHeaders) => ({
                            headers: { ...previous.headers, authorization: `Bearer ${token}` },
                        }))
                    }
                    subscription = forward(operation).subscribe(observer)
                })
                return () => {
                    cancelled = true
                    subscription?.unsubscribe()
                }
            }),
    )
