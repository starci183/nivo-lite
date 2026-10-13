"use server"
import "server-only"

import {
    apiRequest,
    decodeAdminExtended,
    decodeAdminInviteResent,
    decodeAdminPlanSet,
    decodeAdminStatusSet,
    decoded,
} from "@/modules/api"
import type { AdminSupportStatus } from "@/modules/api"

const adminPath = (workspaceId: string, tail: string): string =>
    `/admin/workspaces/${encodeURIComponent(workspaceId)}${tail}`

/** Extends the subscription of a workspace by some days; the back end proves the caller is a platform admin and records the audit. */
export const writeAdminExtend = async (workspaceId: string, days: number) =>
    decoded(
        await apiRequest<unknown>(adminPath(workspaceId, "/extend"), { method: "POST", body: { days } }),
        decodeAdminExtended,
    )

/** Suspends or restores a workspace. */
export const writeAdminStatus = async (workspaceId: string, status: AdminSupportStatus) =>
    decoded(
        await apiRequest<unknown>(adminPath(workspaceId, "/status"), { method: "POST", body: { status } }),
        decodeAdminStatusSet,
    )

/** Sets the plan of a workspace and its own credit limit (null keeps the plan's). */
export const writeAdminPlan = async (workspaceId: string, planCode: string, creditsLimit: number | null) =>
    decoded(
        await apiRequest<unknown>(adminPath(workspaceId, "/plan"), {
            method: "POST",
            body: { planCode, creditsLimit },
        }),
        decodeAdminPlanSet,
    )

/** Sends a pending invitation of a workspace again. */
export const writeAdminInviteResend = async (workspaceId: string, inviteId: string) =>
    decoded(
        await apiRequest<unknown>(adminPath(workspaceId, `/invites/${encodeURIComponent(inviteId)}/resend`), {
            method: "POST",
        }),
        decodeAdminInviteResent,
    )
