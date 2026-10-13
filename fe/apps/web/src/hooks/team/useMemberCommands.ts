"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useMutateChangeMemberRoleSwr, useMutateRemoveMemberSwr, useMutateSetMemberStatusSwr } from "@/hooks/swr"
import { useGraphQLWithToast } from "@/modules/toast"
import { refreshTeam } from "./team.shared"
import type { TeamRole } from "./team.shared"

/** The commands on a member of the workspace. Each answers whether it worked; a failure was toasted with the back end words. */
export interface MemberCommands {
    readonly changeRole: (userId: string, role: TeamRole) => Promise<boolean>
    readonly setStatus: (userId: string, status: "active" | "disabled") => Promise<boolean>
    readonly remove: (userId: string) => Promise<boolean>
    readonly isPending: boolean
}

/** The member commands (role, enable or disable, remove) through the back end, toasted, with the team revalidated on success. */
export const useMemberCommands = (): MemberCommands => {
    const t = useTranslations("team")
    const runGraphQL = useGraphQLWithToast()
    const role = useMutateChangeMemberRoleSwr()
    const status = useMutateSetMemberStatusSwr()
    const removal = useMutateRemoveMemberSwr()
    const changeRole = useCallback(
        async (userId: string, next: TeamRole): Promise<boolean> => {
            const done = await runGraphQL(() => role.trigger({ userId, role: next }), {
                successMessage: t("roleChanged"),
            })
            if (done === undefined) return false
            await refreshTeam()
            return true
        },
        [runGraphQL, role, t],
    )
    const setStatus = useCallback(
        async (userId: string, next: "active" | "disabled"): Promise<boolean> => {
            const done = await runGraphQL(() => status.trigger({ userId, status: next }), {
                successMessage: t(next === "active" ? "memberEnabled" : "memberDisabled"),
            })
            if (done === undefined) return false
            await refreshTeam()
            return true
        },
        [runGraphQL, status, t],
    )
    const remove = useCallback(
        async (userId: string): Promise<boolean> => {
            const done = await runGraphQL(() => removal.trigger({ userId }), { successMessage: t("memberRemoved") })
            if (done === undefined) return false
            await refreshTeam()
            return true
        },
        [runGraphQL, removal, t],
    )
    return { changeRole, setStatus, remove, isPending: role.isMutating || status.isMutating || removal.isMutating }
}
