"use server"
import "server-only"

import { readZaloWizardResult } from "../channels/read-zalo-wizard"
import { writeZaloWizardBegin } from "../channels/write-zalo-wizard"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ZaloAuthorizeUrl } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, invalid } from "./channel-connections.mapper"
import { WIZARD_WAIT_MS, stepFailed } from "./zalo-view"

/** Starts the Zalo sign-in of an OA (owner): the database queues the begin step and the permission address comes back from the back end. */
export const writeZaloAuthorize = async (input: unknown): Promise<DbOutcome<ZaloAuthorizeUrl>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloAuthorize.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    const connectionId = String(parsed.data.input.connectionId)
    const ticket = await writeZaloWizardBegin(connectionId)
    if (ticket.kind !== "ok") return { ...ticket, code: ticket.kind === "refused" ? "errNone" : "errGeneric" }
    const result = await readZaloWizardResult(connectionId, ticket.value, WIZARD_WAIT_MS)
    if (result.kind !== "ok" || result.value.state !== "done" || result.value.url === "") return stepFailed("errGeneric")
    return { kind: "ok", value: { url: result.value.url } }
}
