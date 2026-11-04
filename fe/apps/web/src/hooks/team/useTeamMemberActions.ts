"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { TeamMemberView, TeamRole } from "./team.shared"
import { useMemberCommands } from "./useMemberCommands"

/** A remove or a disable waiting for the person's yes, for one member. */
interface Asking {
    readonly userId: string
    readonly kind: "remove" | "disable"
}

/** The question asked before a remove or a disable. */
interface ConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
}

/** The question asked before a remove or a disable of the named member. */
const confirmOf = (t: ReturnType<typeof useTranslations<"team">>, kind: Asking["kind"], name: string): ConfirmView =>
    kind === "remove"
        ? {
              title: t("confirmRemoveTitle", { name }),
              description: t("confirmRemoveBody"),
              confirmLabel: t("confirmYesRemove"),
          }
        : {
              title: t("confirmDisableTitle", { name }),
              description: t("confirmDisableBody"),
              confirmLabel: t("confirmYesDisable"),
          }

/** The member commands the opened person's pane offers and the question asked before a remove or a disable. */
export interface TeamMemberActions {
    readonly changeRole: (userId: string, role: TeamRole) => void
    readonly enable: (userId: string) => void
    readonly askDisable: (userId: string) => void
    readonly askRemove: (userId: string) => void
    readonly confirm: ConfirmView | undefined
    readonly isPending: boolean
    readonly cancelConfirm: () => void
    readonly acceptConfirm: () => void
}

/** The actions on one member: change a role, disable or enable access, remove (after a yes), toasted by the commands. */
export const useTeamMemberActions = (members: ReadonlyArray<TeamMemberView>): TeamMemberActions => {
    const t = useTranslations("team")
    const commands = useMemberCommands()
    const [asking, setAsking] = useState<Asking>()
    const run = async (job: () => Promise<boolean>) => {
        await job()
        setAsking(undefined)
    }
    const target = members.find((row) => row.userId === asking?.userId)
    return {
        changeRole: (userId, role) => void run(() => commands.changeRole(userId, role)),
        enable: (userId) => void run(() => commands.setStatus(userId, "active")),
        askDisable: (userId) => setAsking({ userId, kind: "disable" }),
        askRemove: (userId) => setAsking({ userId, kind: "remove" }),
        confirm:
            asking === undefined || target === undefined ? undefined : confirmOf(t, asking.kind, target.displayName),
        isPending: commands.isPending,
        cancelConfirm: () => setAsking(undefined),
        acceptConfirm: () => {
            if (target === undefined || asking === undefined) return
            void run(() =>
                asking.kind === "remove"
                    ? commands.remove(target.userId)
                    : commands.setStatus(target.userId, "disabled"),
            )
        },
    }
}
