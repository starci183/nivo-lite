import "server-only"

import { decoded } from "../decode"
import type { Outcome } from "../outcome"
import { apiRequest } from "../request"
import { decodeAdminHealth } from "./admin.mapper"
import type { AdminHealth } from "./admin.mapper"

/** Reads the platform health page: sign-ups, SePay billing, application errors and console activity. */
export const readAdminHealth = async (): Promise<Outcome<AdminHealth>> =>
    decoded(await apiRequest<unknown>("/admin/health"), decodeAdminHealth)
