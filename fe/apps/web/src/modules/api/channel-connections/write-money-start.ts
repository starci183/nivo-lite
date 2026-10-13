"use server"
import "server-only"

import type { Outcome } from "../outcome"
import type { WizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel, invalid } from "./channel-connections.mapper"

/** Creates a bank or payment connection as pending (owner), so its webhook address and key exist for the follow-along step. */
export const writeMoneyStart = async (input: unknown): Promise<Outcome<WizardConnection>> => {
    const parsed = channelSchemas.moneyStart.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<WizardConnection>(parsed.data)
}
