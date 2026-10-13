"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { MetaAuthorization } from "@/modules/types"
import { metaAuthorizeSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Starts (or restarts) the Facebook login (owner): a pending connection is made on first use and the signed state goes to Meta. */
export const writeMetaAuthorize = async (input: unknown): Promise<DbOutcome<MetaAuthorization>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = metaAuthorizeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaAuthorization>(parsed.data)
}
