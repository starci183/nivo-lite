import type { GetAdminSessionRequest, GetAdminSessionResult } from "../../application/get-admin-session.contracts"
import type { AdminSessionType } from "./dto/admin-session.type"

/** Maps nothing to the application request. */
export const toAdminSessionRequest = (): GetAdminSessionRequest => ({})

/** Maps the application result to the GraphQL type. */
export const toAdminSessionType = (result: GetAdminSessionResult): AdminSessionType => ({ email: result.email })
