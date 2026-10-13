"use server"
import "server-only"

import { awaitCommand } from "../commands/read-command"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { extendInputSchema, planInputSchema, resendInputSchema, statusInputSchema } from "./admin.mapper"
import type { AdminInviteResent, AdminSupportStatus } from "./admin.mapper"

/** Extends the subscription of a workspace by some days; the database function proves the caller is platform staff and records the audit. */
export const writeAdminExtend = async (
    workspaceId: string,
    days: number,
): Promise<DbOutcome<{ readonly paidUntil: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = extendInputSchema.safeParse(workspaceId, days)
    if (!parsed.success) return dbFailure("invalid", "admin-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("admin_extend_subscription", {
        p_workspace: parsed.data.workspaceId,
        p_days: parsed.data.days,
    })
    return error === null ? dbOk({ paidUntil: data }) : rpcFailure(error)
}

/** Suspends or restores a workspace. */
export const writeAdminStatus = async (
    workspaceId: string,
    status: AdminSupportStatus,
): Promise<DbOutcome<{ readonly status: AdminSupportStatus }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = statusInputSchema.safeParse(workspaceId, status)
    if (!parsed.success) return dbFailure("invalid", "admin-input")
    const client = await createServerDbClient()
    const { error } = await client.rpc("admin_set_workspace_status", {
        p_workspace: parsed.data.workspaceId,
        p_status: parsed.data.status,
    })
    return error === null ? dbOk({ status: parsed.data.status }) : rpcFailure(error)
}

/** Sets the plan of a workspace and its own credit limit (null keeps the plan's). */
export const writeAdminPlan = async (
    workspaceId: string,
    planCode: string,
    creditsLimit: number | null,
): Promise<DbOutcome<{ readonly planCode: string; readonly creditsLimit: number | null }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = planInputSchema.safeParse(workspaceId, planCode, creditsLimit)
    if (!parsed.success) return dbFailure("invalid", "admin-input")
    const client = await createServerDbClient()
    const { error } = await client.rpc("admin_set_workspace_plan", {
        p_workspace: parsed.data.workspaceId,
        p_plan: parsed.data.planCode,
        ...(parsed.data.creditsLimit === null ? {} : { p_credits: parsed.data.creditsLimit }),
    })
    return error === null
        ? dbOk({ planCode: parsed.data.planCode, creditsLimit: parsed.data.creditsLimit })
        : rpcFailure(error)
}

/** Sends a pending invitation of a workspace again: the database function proves platform staff and queues the back end job that emails it. */
export const writeAdminInviteResend = async (
    workspaceId: string,
    inviteId: string,
): Promise<DbOutcome<AdminInviteResent>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = resendInputSchema.safeParse(workspaceId, inviteId)
    if (!parsed.success) return dbFailure("invalid", "admin-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("request_admin_invite_resend", {
        p_workspace: parsed.data.workspaceId,
        p_invite: parsed.data.inviteId,
    })
    if (error !== null) return rpcFailure(error)
    const answer = await awaitCommand(data)
    if (answer.kind !== "ok") return answer
    const { email, delivery } = answer.value
    return typeof email === "string" && (delivery === "invited" || delivery === "existing" || delivery === "none")
        ? dbOk({ email, delivery })
        : dbFailure("unavailable", "invite-shape")
}
