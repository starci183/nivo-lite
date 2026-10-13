"use server"
import "server-only"

import { readZaloWizardResult } from "../channels/read-zalo-wizard"
import { writeZaloWizardOaSecret } from "../channels/write-zalo-wizard"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { CHANNEL_FAILURE_KEYS, channelSchemas, invalid } from "./channel-connections.mapper"
import { WIZARD_WAIT_MS, stepFailed } from "./zalo-view"

/** Stores the OA Secret Key of the Zalo app's Webhook screen (owner): the database queues its sealing and the back end answers next to the ticket. */
export const writeZaloOaSecret = async (input: unknown): Promise<DbOutcome<true>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloOaSecret.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    const connectionId = String(parsed.data.input.connectionId)
    const ticket = await writeZaloWizardOaSecret({ connectionId, oaSecret: parsed.data.input.oaSecret })
    if (ticket.kind !== "ok") return { ...ticket, code: ticket.kind === "refused" ? "errNone" : "errGeneric" }
    const result = await readZaloWizardResult(connectionId, ticket.value, WIZARD_WAIT_MS)
    if (result.kind !== "ok" || result.value.state !== "done") return stepFailed("errGeneric")
    return { kind: "ok", value: true }
}
