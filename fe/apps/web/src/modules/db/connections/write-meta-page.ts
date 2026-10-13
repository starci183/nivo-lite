"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { MetaWizardConnection } from "@/modules/types"
import { metaPageSchema, FAILURE_KEYS, sendCommand, invalid } from "./command.mapper"

/** Chooses the Page of a Meta connection (owner): the api subscribes it to the app webhook and keeps only its token. */
export const writeMetaPage = async (input: unknown): Promise<DbOutcome<MetaWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", FAILURE_KEYS.refused)
    const parsed = metaPageSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaWizardConnection>(parsed.data)
}
