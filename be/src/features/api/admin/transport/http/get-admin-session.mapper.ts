import type { GetAdminSessionRequest, GetAdminSessionResult } from "../../application/get-admin-session.contracts"
import type { GetAdminSessionResponse } from "./dto/get-admin-session.response"

/** Maps the HTTP request to the application request. */
export const toGetAdminSessionRequest = (): GetAdminSessionRequest => ({})

/** Maps the application result to the HTTP response. */
export const toGetAdminSessionResponse = (result: GetAdminSessionResult): GetAdminSessionResponse => ({
    email: result.email,
})
