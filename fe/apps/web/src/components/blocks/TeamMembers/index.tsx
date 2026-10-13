"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import type { DataTableColumn, DropdownMenuEntry } from "@starci/grammar/common"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, canManageMember, roleChoices, useMemberCommands, useTeam } from "@/hooks/team"
import type { TeamMemberView } from "@/hooks/team"
import { TeamMembersBase } from "./component"

/** A remove or a disable waiting for the person's yes. */
interface Asking {
    readonly userId: string
    readonly kind: "remove" | "disable"
}

/** The connected members table: change a role, disable or enable access, remove (after a yes), through the back end GraphQL API (outcome toasted). */
export const TeamMembers = () => {
    const t = useTranslations("team")
    const format = useFormatter()
    const member = useMember()
    const selfRole = member?.role ?? "staff"
    const selfId = member?.userId ?? ""
    const isAllowed = member !== null && isTeamManager(member.role)
    const { views, isLoading } = useTeam(member?.workspaceId ?? "", isAllowed)
    const commands = useMemberCommands()
    const [asking, setAsking] = useState<Asking>()

    const run = async (job: () => Promise<boolean>) => {
        await job()
        setAsking(undefined)
    }

    const entriesFor = (row: TeamMemberView): ReadonlyArray<DropdownMenuEntry> => {
        const sections: DropdownMenuEntry[] = [
            {
                kind: "section",
                id: "role",
                label: t("colRole"),
                items: roleChoices(selfRole).map((role) => ({ id: `role:${role}`, label: t(ROLE_KEYS[role]) })),
                selection: {
                    mode: "single",
                    selectedIds: [`role:${row.role}`],
                    onChange: (ids) => {
                        const role = roleChoices(selfRole).find((choice) => `role:${choice}` === ids[0])
                        if (role !== undefined && role !== row.role)
                            void run(() => commands.changeRole(row.userId, role))
                    },
                },
            },
        ]
        if (row.userId !== selfId) {
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
                        tone: "negative",
                        onAction: () => setAsking({ userId: row.userId, kind: "remove" }),
                    },
                ],
            })
        }
        return sections
    }

    const columns: ReadonlyArray<DataTableColumn> = [
        { id: "member", label: t("colMember"), isRowHeader: true },
        { id: "role", label: t("colRole") },
        { id: "status", label: t("colStatus") },
        { id: "lastSignIn", label: t("colLastSignIn") },
        { id: "actions", label: t("colActions"), align: "end" },
    ]
    const target = views.members.find((row) => row.userId === asking?.userId)
    const confirmOf = () => {
        if (asking === undefined || target === undefined) return undefined
        if (asking.kind === "remove") {
            return {
                title: t("confirmRemoveTitle", { name: target.displayName }),
                description: t("confirmRemoveBody"),
                confirmLabel: t("confirmYesRemove"),
            }
        }
        return {
            title: t("confirmDisableTitle", { name: target.displayName }),
            description: t("confirmDisableBody"),
            confirmLabel: t("confirmYesDisable"),
        }
    }

    if (!isAllowed) return null
    return (
        <TeamMembersBase
            props={{
                title: t("membersTitle"),
                description: isLoading ? undefined : t("membersDesc", { count: views.members.length }),
                failTitle: t("errGeneric"),
                youLabel: t("you"),
                activeLabel: t("statusActive"),
                disabledLabel: t("statusDisabled"),
                actionsLabel: t("colActions"),
                cancelLabel: t("confirmNo"),
                columns,
                rows: views.members.map((row) => ({
                    id: row.userId,
                    name: row.displayName,
                    email: row.email,
                    isYou: row.userId === selfId,
                    staffNote: row.staffName === null ? undefined : t("linkedStaff", { name: row.staffName }),
                    roleLabel: t(ROLE_KEYS[row.role]),
                    isActive: row.isActive,
                    lastSignIn:
                        row.lastSignInAt === null
                            ? t("neverSignedIn")
                            : format.dateTime(new Date(row.lastSignInAt), { dateStyle: "medium", timeStyle: "short" }),
                    menuLabel: t("rowMore", { name: row.displayName }),
                    entries: canManageMember(selfRole, row) ? entriesFor(row) : [],
                })),
                isSkeleton: isLoading,
                isPending: commands.isPending,
                confirm: confirmOf(),
            }}
            on={{
                cancelConfirm: () => setAsking(undefined),
                confirm: () => {
                    if (target === undefined || asking === undefined) return
                    void run(() =>
                        asking.kind === "remove"
                            ? commands.remove(target.userId)
                            : commands.setStatus(target.userId, "disabled"),
                    )
                },
            }}
        />
    )
}
