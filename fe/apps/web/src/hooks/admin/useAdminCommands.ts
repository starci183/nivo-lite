import { useMemo } from "react"
import type { AdminSupportStatus } from "@/modules/db/admin/admin.mapper"
import type { DbOutcome } from "@/modules/db/outcome"
import {
    writeAdminExtend,
    writeAdminInviteResend,
    writeAdminPlan,
    writeAdminStatus,
} from "@/modules/db/admin/write-admin-support"
import type { AdminReply } from "./admin.shared"

/** The support actions the console makes on one workspace; each answers what it came to. */
export interface AdminCommands {
    readonly extend: (days: number) => Promise<AdminReply>
    readonly setStatus: (status: AdminSupportStatus) => Promise<AdminReply>
    readonly setPlan: (planCode: string, creditsLimit: number | null) => Promise<AdminReply>
    readonly resendInvite: (inviteId: string) => Promise<AdminReply>
}

const replyOf = <T>(outcome: DbOutcome<T>, isUndelivered: (value: T) => boolean): AdminReply =>
    outcome.kind === "ok"
        ? { kind: "ok", isUndelivered: isUndelivered(outcome.value) }
        : { kind: "failed", message: outcome.code }

/** The support actions of one workspace, run as Server Actions; the database proves the platform admin. */
export const useAdminCommands = (workspaceId: string): AdminCommands =>
    useMemo<AdminCommands>(
        () => ({
            extend: async (days) => replyOf(await writeAdminExtend(workspaceId, days), () => false),
            setStatus: async (status) => replyOf(await writeAdminStatus(workspaceId, status), () => false),
            setPlan: async (planCode, creditsLimit) =>
                replyOf(await writeAdminPlan(workspaceId, planCode, creditsLimit), () => false),
            resendInvite: async (inviteId) =>
                replyOf(await writeAdminInviteResend(workspaceId, inviteId), (sent) => sent.delivery === "none"),
        }),
        [workspaceId],
    )
