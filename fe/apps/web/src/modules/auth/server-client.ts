import type { GraphQLResponse } from "@/modules/types"
import type { NextRequest } from "next/server"
import { sessionDoor } from "./auth-door"
import { authFailure, authOk } from "./outcome"

/**
 * Asks the back end whether the cookies of the request hold a live session: `GET /auth/session` with the cookie header forwarded.
 * The door does not rotate the refresh cookie, so the many requests of one browser never race over it. The access token the
 * door answers is dropped: the proxy only gates routes.
 */
export const checkSession = async (request: NextRequest): Promise<GraphQLResponse<true>> => {
    const cookie = request.headers.get("cookie")
    if (cookie === null || cookie === "") return authFailure("refused", "no-session")
    try {
        const answer = await sessionDoor({ cookie })
        if (answer.status >= 200 && answer.status < 300) return authOk(true)
        return authFailure(
            answer.status === 401 || answer.status === 403 ? "refused" : "unavailable",
            String(answer.status),
        )
    } catch {
        return authFailure("unavailable", "transport")
    }
}
