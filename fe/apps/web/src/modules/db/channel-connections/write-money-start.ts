"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { WizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel } from "./channel-connections.mapper"

/** Creates a bank or payment connection as pending (owner), so its webhook address and key exist for the follow-along step. */
export const writeMoneyStart = async (input: unknown): Promise<DbOutcome<WizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.moneyStart.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<WizardConnection>(apiRequest, parsed.data)
}
