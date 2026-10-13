"use server"
import "server-only"

import { readZaloWizardResult } from "../channels/read-zalo-wizard"
import { writeZaloWizardStart } from "../channels/write-zalo-wizard"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import type { ZaloWizardConnection } from "@/modules/types"
import { CHANNEL_FAILURE_KEYS, channelSchemas, invalid } from "./channel-connections.mapper"
import { WIZARD_WAIT_MS, stepFailed, zaloViewOf } from "./zalo-view.mapper"

/** Keeps the Zalo app's keys as a pending connection (owner): the database queues their sealing, then the wizard view comes back. */
export const writeZaloStart = async (input: unknown): Promise<DbOutcome<ZaloWizardConnection>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", CHANNEL_FAILURE_KEYS.refused)
    const parsed = channelSchemas.zaloStart.safeParse(input)
    if (!parsed.success) return invalid(CHANNEL_FAILURE_KEYS.invalid)
    const started = await writeZaloWizardStart(parsed.data.input)
    if (started.kind !== "ok") return { ...started, code: started.kind === "refused" ? "errNone" : "errGeneric" }
    const sealed = await readZaloWizardResult(started.value, null, WIZARD_WAIT_MS)
    if (sealed.kind !== "ok" || sealed.value.state !== "done") return stepFailed("errGeneric")
    return zaloViewOf(started.value)
}
