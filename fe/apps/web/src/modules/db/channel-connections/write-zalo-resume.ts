"use server"
import "server-only"

import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, invalid } from "./channel-connections.mapper"
import { zaloViewOf } from "./zalo-view.mapper"

/** Continues an unfinished or broken Zalo connection (owner); keys are never returned. */
export const writeZaloResume = async (input: unknown): Promise<DbOutcome<ZaloWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloResume.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    const view = await zaloViewOf(String(parsed.data.input.connectionId))
    return view.kind === "ok" ? view : { ...view, code: "errNone" }
}
