"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { MetaWizardConnection } from "@/modules/types"
import { metaResumeSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Reopens an unfinished Meta connection (owner): the Pages waiting for the choice, or the chosen one; tokens are never returned. */
export const writeMetaResume = async (input: unknown): Promise<DbOutcome<MetaWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = metaResumeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaWizardConnection>(parsed.data)
}
