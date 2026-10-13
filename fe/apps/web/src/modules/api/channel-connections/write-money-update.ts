"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { WizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Edits a bank or payment connection after it was created (owner); a blank account number keeps the stored one. */
export const writeMoneyUpdate = async (input: unknown): Promise<Outcome<WizardConnection>> => {
    const parsed = channelSchemas.moneyUpdate.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<WizardConnection>(parsed.data)
}
