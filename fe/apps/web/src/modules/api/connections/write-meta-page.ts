"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { MetaWizardConnection } from "@/modules/types"
import { metaPageSchema, FAILURE_KEYS, sendCommand, invalid } from "./connections.mapper"

/** Chooses the Page of a Meta connection (owner): the api subscribes it to the app webhook and keeps only its token. */
export const writeMetaPage = async (input: unknown): Promise<Outcome<MetaWizardConnection>> => {
    const parsed = metaPageSchema.safeParse(input)
    if (!parsed.success) return invalid(FAILURE_KEYS.invalid)
    return sendCommand<MetaWizardConnection>(parsed.data)
}
