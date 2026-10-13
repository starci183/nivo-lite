"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { WizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Continues an unfinished bank or payment connection (owner): the data the wizard had; payOS and Casso keys are never returned. */
export const writeMoneyResume = async (input: unknown): Promise<Outcome<WizardConnection>> => {
    const parsed = channelSchemas.moneyResume.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<WizardConnection>(parsed.data)
}
