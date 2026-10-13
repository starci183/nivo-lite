"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { MetaWizardConnection } from "@/modules/types"
import { metaResumeSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Reopens an unfinished Meta connection (owner): the Pages waiting for the choice, or the chosen one; tokens are never returned. */
export const writeMetaResume = async (input: unknown): Promise<Outcome<MetaWizardConnection>> => {
    const parsed = metaResumeSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaWizardConnection>(parsed.data)
}
