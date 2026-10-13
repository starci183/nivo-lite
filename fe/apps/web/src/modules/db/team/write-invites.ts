"use server"
import "server-only"

import { apiRequest, decodeInviteResult, decodeNothing, decoded } from "@/modules/api"
import type { Outcome } from "@/modules/api"

/** What a person types to invite someone. */
interface InviteInput {
    readonly email: string
    readonly role: "manager" | "staff"
    /** The staff row the account will be, or null. */
    readonly staffId: string | null
}

const invitePath = (inviteId: string, tail: string): string =>
    `/workspaces/invites/${encodeURIComponent(inviteId)}${tail}`

/** Invites someone by email; the back end proves the caller is an owner or a manager of the workspace. */
export const writeInviteCreate = async (workspaceId: string, input: InviteInput) =>
    decoded(
        await apiRequest<unknown>("/workspaces/invites", {
            method: "POST",
            workspaceId,
            body: {
                email: input.email.trim(),
                role: input.role,
                ...(input.staffId === null ? {} : { staffId: input.staffId }),
            },
        }),
        decodeInviteResult,
    )

/** Sends an invitation again. */
export const writeInviteResend = async (workspaceId: string, inviteId: string) =>
    decoded(
        await apiRequest<unknown>(invitePath(inviteId, "/resend"), { method: "POST", workspaceId }),
        decodeInviteResult,
    )

/** Mints a fresh link for an invitation. */
export const writeInviteLink = async (workspaceId: string, inviteId: string) =>
    decoded(
        await apiRequest<unknown>(invitePath(inviteId, "/link"), { method: "POST", workspaceId }),
        decodeInviteResult,
    )

/** Revokes an invitation. */
export const writeInviteRevoke = async (workspaceId: string, inviteId: string): Promise<Outcome<null>> =>
    decoded(await apiRequest<unknown>(invitePath(inviteId, ""), { method: "DELETE", workspaceId }), decodeNothing)
