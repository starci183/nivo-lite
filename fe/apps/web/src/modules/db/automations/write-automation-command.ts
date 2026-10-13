"use server"
import "server-only"

import { setTimeout as pause } from "node:timers/promises"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { parseCommandInput } from "./automations.input"

const POLL_MS = 1000
const POLLS_MAX = 45

/** How a command ended: done with its answer, or failed with the code of the reason. */
export interface AutomationCommandView {
    readonly status: "done" | "failed"
    readonly faultCode: string | null
    /** The proposed wording of a `propose_body` command that is done. */
    readonly proposal: { readonly body: string; readonly generated: boolean } | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const proposalOf = (result: unknown): AutomationCommandView["proposal"] => {
    if (!isRecord(result) || typeof result.body !== "string" || typeof result.generated !== "boolean") return null
    return { body: result.body, generated: result.generated }
}

type Db = Awaited<ReturnType<typeof createServerDbClient>>

const settle = async (db: Db, commandId: string, left: number): Promise<DbOutcome<AutomationCommandView>> => {
    await pause(POLL_MS)
    const read = toOutcome(
        await db.from("automation_commands").select("status, result, fault_code").eq("id", commandId).single(),
    )
    if (read.kind !== "ok") return read
    const { status } = read.value
    if (status === "done" || status === "failed") {
        return dbOk({ status, faultCode: read.value.fault_code, proposal: proposalOf(read.value.result) })
    }
    return left <= 1 ? dbFailure("unavailable", "command-timeout") : settle(db, commandId, left - 1)
}

/**
 * Runs a command that only the back end can do for a manager of the workspace: the shop's own wording written with a model, or one run
 * of a scheduled workflow. A database function proves the manager and queues the job in the same transaction; the back-end job writes
 * its answer on the command row, which this action reads under RLS until it is there. The answer is how the command ended.
 */
export const writeAutomationCommand = async (input: unknown): Promise<DbOutcome<AutomationCommandView>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = parseCommandInput(input)
    if (!parsed.success) return dbFailure("invalid", "automation-command-input")
    const db = await createServerDbClient()
    const queued = toOutcome(
        await db.rpc("automation_command_enqueue", {
            p_workspace: parsed.data.workspaceId,
            p_kind: parsed.data.kind,
            p_template: parsed.data.templateKey,
        }),
    )
    if (queued.kind !== "ok") return queued
    return settle(db, queued.value, POLLS_MAX)
}
