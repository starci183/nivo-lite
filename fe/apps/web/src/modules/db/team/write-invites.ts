"use server"
import "server-only"

import { awaitCommand } from "../commands/read-command"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { rpcFailure } from "../rpc-failure"
import { createServerDbClient } from "../server"
import { inviteInputSchema, inviteRefSchema, inviteResultOf } from "./team.mapper"
import type { InviteResultItem } from "./team.mapper"

/** The invitation command the back end serves: it mints the token, emails the person and answers the link. */
const serve = async (commandId: string): Promise<DbOutcome<InviteResultItem>> => {
    const answer = await awaitCommand(commandId)
    if (answer.kind !== "ok") return answer
    const result = inviteResultOf(answer.value)
    return result === null ? dbFailure("unavailable", "invite-shape") : dbOk(result)
}

/** Invites someone by email; the database proves the caller is an owner or a manager and queues the back end job that sends it. */
export const writeInviteCreate = async (workspaceId: string, input: unknown): Promise<DbOutcome<InviteResultItem>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = inviteInputSchema.safeParse({ ...(typeof input === "object" ? input : {}), workspaceId })
    if (!parsed.success) return dbFailure("invalid", "invite-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("request_invite_command", {
        p_workspace: parsed.data.workspaceId,
        p_action: "create",
        p_email: parsed.data.email,
        p_role: parsed.data.role,
        ...(parsed.data.staffId === null ? {} : { p_staff: parsed.data.staffId }),
    })
    return error === null ? serve(data) : rpcFailure(error)
}

const reissue = async (action: "resend" | "link", workspaceId: string, inviteId: string) => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = inviteRefSchema.safeParse(workspaceId, inviteId)
    if (!parsed.success) return dbFailure("invalid", "invite-input")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("request_invite_command", {
        p_workspace: parsed.data.workspaceId,
        p_action: action,
        p_invite: parsed.data.inviteId,
    })
    return error === null ? serve(data) : rpcFailure(error)
}

/** Sends an invitation again with a fresh link. */
export const writeInviteResend = async (workspaceId: string, inviteId: string): Promise<DbOutcome<InviteResultItem>> =>
    reissue("resend", workspaceId, inviteId)

/** Mints a fresh link for an invitation without emailing it. */
export const writeInviteLink = async (workspaceId: string, inviteId: string): Promise<DbOutcome<InviteResultItem>> =>
    reissue("link", workspaceId, inviteId)

/** Revokes an invitation; the database proves the caller is an owner or a manager. */
export const writeInviteRevoke = async (workspaceId: string, inviteId: string): Promise<DbOutcome<null>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = inviteRefSchema.safeParse(workspaceId, inviteId)
    if (!parsed.success) return dbFailure("invalid", "invite-input")
    const client = await createServerDbClient()
    const { error } = await client.rpc("revoke_workspace_invite", {
        p_workspace: parsed.data.workspaceId,
        p_invite: parsed.data.inviteId,
    })
    return error === null ? dbOk(null) : rpcFailure(error)
}
