import type { NextRequest } from "next/server"
import type { GraphQLResponse } from "@/modules/types"
import { auth } from "./client"

/**
 * Asks the back end whether the cookies of the request hold a live session: `GET /auth/session` with the cookie header forwarded.
 * The door does not rotate the refresh cookie, so the many requests of one browser never race over it. The access token the
 * door answers is dropped: the proxy only gates routes.
 */
export const checkSession = (request: NextRequest): Promise<GraphQLResponse<true>> =>
    auth.checkSession(request.headers.get("cookie"))
