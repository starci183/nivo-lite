"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { MetaAuthorization } from "@/modules/types"
import { metaAuthorizeSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Starts (or restarts) the Facebook login (owner): a pending connection is made on first use and the signed state goes to Meta. */
export const writeMetaAuthorize = async (input: unknown): Promise<Outcome<MetaAuthorization>> => {
    const parsed = metaAuthorizeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaAuthorization>(parsed.data)
}
