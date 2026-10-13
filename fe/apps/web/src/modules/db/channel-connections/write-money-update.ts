"use server"
import "server-only"

import { apiRequest } from "@/modules/api"
import { dbFailure } from "@/modules/db/outcome"
import type { DbOutcome } from "@/modules/db/outcome"
import { getPrincipal } from "@/modules/db/principal"
import type { WizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, sendChannel } from "./channel-connections.mapper"

/** Edits a bank or payment connection after it was created (owner); a blank account number keeps the stored one. */
export const writeMoneyUpdate = async (input: unknown): Promise<DbOutcome<WizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.moneyUpdate.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", CHANNEL_FAILURE_KEYS.invalid)
    return sendChannel<WizardConnection>(apiRequest, parsed.data)
}
