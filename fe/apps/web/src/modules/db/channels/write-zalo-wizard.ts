"use server"
import "server-only"

import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"
import { zaloAppSchema, zaloConnectionSchema, zaloOaSecretSchema } from "./zalo-wizard.mapper"

/**
 * Starts a Zalo connection: the database function proves the caller owns the workspace, creates the pending connection and queues the sealing of
 * its keys, which the back end carries out. The answer is the connection id; the keys are never read back.
 */
export const writeZaloWizardStart = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = zaloAppSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `zalo-wizard-${parsed.field}`)
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("zalo_wizard_start", {
            p_workspace: workspace.value.id,
            p_name: parsed.data.name,
            p_app_id: parsed.data.appId,
            p_app_secret: parsed.data.appSecret,
        }),
    )
}

/** Queues the sealing of the OA Secret Key of a connection; the answer is the ticket the back end writes its result next to. */
export const writeZaloWizardOaSecret = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = zaloOaSecretSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `zalo-wizard-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(
        await db.rpc("zalo_wizard_oa_secret", {
            p_connection: parsed.data.connectionId,
            p_oa_secret: parsed.data.oaSecret,
        }),
    )
}

/** Queues the building of the Zalo permission URL of a connection; the answer is the ticket the back end writes the URL next to. */
export const writeZaloWizardBegin = async (input: unknown): Promise<DbOutcome<string>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = zaloConnectionSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", `zalo-wizard-${parsed.field}`)
    const db = await createServerDbClient()
    return toOutcome(await db.rpc("zalo_wizard_begin", { p_connection: parsed.data }))
}
