import "server-only"

import { request } from "../client"
import type { Outcome } from "../outcome"
import { decodeAdminSession } from "./admin.mapper"
import type { AdminSession } from "./admin.mapper"

/** Who is calling and in which language: the two facts every admin read sends. */
export interface AdminReadInput {
    /** The signed-in person's access token. */
    readonly token: string
    /** The reader's locale. */
    readonly locale: string
}

/** Asks the back end who the platform admin is; anyone else is refused or not found. */
export const readAdminSession = (input: AdminReadInput): Promise<Outcome<AdminSession>> =>
    request({ path: "/admin/session", token: input.token, locale: input.locale }, decodeAdminSession)
