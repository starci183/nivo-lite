import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeAdminSession } from "./admin.mapper"
import type { AdminSession } from "./admin.mapper"

/** Asks the back end who the platform admin is; anyone else is refused or not found. */
export const readAdminSession = async (): Promise<Outcome<AdminSession>> =>
    decoded(await apiRequest<unknown>("/admin/session"), decodeAdminSession)
