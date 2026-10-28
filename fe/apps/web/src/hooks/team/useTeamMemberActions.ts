"use client"

import type { DataTableColumn, DropdownMenuEntry } from "@starci/grammar/common"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ROLE_KEYS, roleChoices } from "./team.shared"
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

/** The member commands, the columns, the menu of each row and the question asked before a remove or a disable. */
export interface TeamMemberActions {
    readonly columns: ReadonlyArray<DataTableColumn>
    readonly entriesFor: (row: TeamMemberView) => ReadonlyArray<DropdownMenuEntry>
    readonly confirm: ConfirmView | undefined
    readonly isPending: boolean
    readonly cancelConfirm: () => void
    readonly acceptConfirm: () => void
}

/** The actions on the members table: change a role, disable or enable access, remove (after a yes), toasted by the commands. */
export const useTeamMemberActions = (
    members: ReadonlyArray<TeamMemberView>,
    selfRole: TeamRole,
    selfId: string,
): TeamMemberActions => {
    const t = useTranslations("team")
    const commands = useMemberCommands()
    const [asking, setAsking] = useState<Asking>()
    const run = async (job: () => Promise<boolean>) => {
        await job()
        setAsking(undefined)
    }
    const entriesFor = (row: TeamMemberView): ReadonlyArray<DropdownMenuEntry> => {
        const choices = roleChoices(selfRole)
        const sections: DropdownMenuEntry[] = [
            {
                kind: "section",
                id: "role",
                label: t("colRole"),
                items: choices.map((role) => ({ id: `role:${role}`, label: t(ROLE_KEYS[role]) })),
                selection: {
                    mode: "single",
                    selectedIds: [`role:${row.role}`],
                    onChange: (ids) => {
                        const role = choices.find((choice) => `role:${choice}` === ids[0])
                        if (role !== undefined && role !== row.role)
                            void run(() => commands.changeRole(row.userId, role))
                    },
                },
            },
        ]
        if (row.userId === selfId) return sections
        sections.push({
            kind: "section",
            id: "access",
            items: [
                row.isActive
                    ? {
                          id: "disable",
                          label: t("actionDisable"),
                          onAction: () => setAsking({ userId: row.userId, kind: "disable" }),
                      }
                    : {
                          id: "enable",
                          label: t("actionEnable"),
                          onAction: () => void run(() => commands.setStatus(row.userId, "active")),
                      },
                {
                    id: "remove",
                    label: t("actionRemove"),
                    tone: "danger",
                    onAction: () => setAsking({ userId: row.userId, kind: "remove" }),
                },
            ],
        })
        return sections
    }
    const target = members.find((row) => row.userId === asking?.userId)
    return {
        columns: [
            { id: "member", label: t("colMember"), isRowHeader: true },
            { id: "role", label: t("colRole") },
            { id: "status", label: t("colStatus") },
            { id: "lastSignIn", label: t("colLastSignIn") },
            { id: "actions", label: t("colActions"), align: "end" },
        ],
        entriesFor,
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
