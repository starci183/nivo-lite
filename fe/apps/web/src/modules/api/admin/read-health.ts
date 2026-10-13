import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeAdminHealth } from "./admin.mapper"
import type { AdminHealth } from "./admin.mapper"
import type { AdminReadInput } from "./read-session"

/** Reads the platform health page: sign-ups, SePay billing, application errors and console activity. */
export const readAdminHealth = (input: AdminReadInput): Promise<Outcome<AdminHealth>> =>
    request({ path: "/admin/health", token: input.token, locale: input.locale }, decodeAdminHealth)
