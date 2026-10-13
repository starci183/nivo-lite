import { CombinedGraphQLErrors } from "@apollo/client"
import { ErrorLink } from "@apollo/client/link/error"
import { endSession } from "@/modules/auth"
import { loginPath } from "@/modules/routes"

/**
 * Handles the failure that no retry can fix: when the back end still refuses the session after the refresh link tried
 * (`unauthenticated`), the browser session is dead, so it is ended and the person is sent to the sign-in page. Every other
 * failure is not swallowed: the operation still rejects, so the hook or the toast helper above shows the (server-localized)
 * message.
 *
 * @see {@link https://www.apollographql.com/docs/react/api/link/apollo-link-error | ErrorLink API}
 */
export const createErrorLink = () =>
    new ErrorLink(({ error }) => {
        if (!CombinedGraphQLErrors.is(error)) return
        if (!error.errors.some((failure) => failure.extensions?.kind === "unauthenticated")) return
        void endSession().then(() => {
            if (typeof window !== "undefined") window.location.assign(loginPath())
        })
    })
