import { createAuthClient } from "@starci/auth/client"
import type { NextRequest } from "next/server"
import { apiUrl } from "@/modules/config"
import type { GraphQLResponse } from "@/modules/types"

/** The client of the proxy: it holds no session of its own, it only forwards the cookies of the request it judges. */
const server = createAuthClient({ apiOrigin: () => apiUrl() })

/**
 * Asks the back end whether the cookies of the request hold a live session: `GET /auth/session` with the cookie header forwarded.
 * The door does not rotate the refresh cookie, so the many requests of one browser never race over it. The access token the
 * door answers is dropped: the proxy only gates routes.
 */
export const checkSession = (request: NextRequest): Promise<GraphQLResponse<true>> =>
    server.checkSession(request.headers.get("cookie"))
