"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { DataTableColumn, DropdownMenuEntry } from "@starci/grammar/common"
import { ROLE_KEYS, canManageMember, roleChoices, teamErrorKey } from "@/hooks/team"
import type { TeamMemberView, TeamRole } from "@/hooks/team"
import { navigation } from "@/modules/i18n"
import { writeMemberRole } from "@/modules/db/team/write-member-role"
import { writeMemberStatus } from "@/modules/db/team/write-member-status"
import { writeRemoveMember } from "@/modules/db/team/write-remove-member"
import { TeamMembersBase } from "./component"

/** Props for the connected members table. */
interface TeamMembersProps {
    readonly workspaceId: string
    readonly selfId: string
    readonly selfRole: TeamRole
    readonly members: ReadonlyArray<TeamMemberView>
    /** True while the page loads: the heading and column headers stay, the body is skeleton rows. */
    readonly isLoading?: boolean
}

/** A remove or a disable waiting for the person's yes. */
interface Asking {
    readonly userId: string
    readonly kind: "remove" | "disable"
}

/** The connected members table: change a role, disable or enable access, remove (after a yes), through Server Actions under RLS. */
export const TeamMembers = (props: TeamMembersProps) => {
    const t = useTranslations("team")
    const format = useFormatter()
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string>()
    const [asking, setAsking] = useState<Asking>()

    const run = (job: () => Promise<{ readonly kind: string; readonly code?: string }>) => {
        setError(undefined)
        startTransition(async () => {
            const result = await job()
            setAsking(undefined)
            if (result.kind === "ok") return router.refresh()
            setError(t(teamErrorKey(result.code ?? "")))
        })
    }
    const command = (member: TeamMemberView) => ({ workspaceId: props.workspaceId, userId: member.userId })

    const entriesFor = (member: TeamMemberView): ReadonlyArray<DropdownMenuEntry> => {
        const sections: DropdownMenuEntry[] = [
            {
                kind: "section",
                id: "role",
                label: t("colRole"),
                items: roleChoices(props.selfRole).map((role) => ({ id: `role:${role}`, label: t(ROLE_KEYS[role]) })),
                selection: {
                    mode: "single",
                    selectedIds: [`role:${member.role}`],
                    onChange: (ids) => {
                        const role = roleChoices(props.selfRole).find((choice) => `role:${choice}` === ids[0])
                        if (role !== undefined && role !== member.role)
                            run(() => writeMemberRole({ ...command(member), role }))
                    },
                },
            },
        ]
        if (member.userId !== props.selfId) {
            sections.push({
                kind: "section",
                id: "access",
                items: [
                    member.isActive
                        ? {
                              id: "disable",
                              label: t("actionDisable"),
                              onAction: () => setAsking({ userId: member.userId, kind: "disable" }),
                          }
                        : {
                              id: "enable",
                              label: t("actionEnable"),
                              onAction: () => run(() => writeMemberStatus({ ...command(member), status: "active" })),
                          },
                    {
                        id: "remove",
                        label: t("actionRemove"),
                        tone: "negative",
                        onAction: () => setAsking({ userId: member.userId, kind: "remove" }),
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
    const isLoading = props.isLoading ?? false
    const target = props.members.find((member) => member.userId === asking?.userId)
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

    return (
        <TeamMembersBase
            props={{
                title: t("membersTitle"),
                description: isLoading ? undefined : t("membersDesc", { count: props.members.length }),
                failTitle: t("errGeneric"),
                youLabel: t("you"),
                activeLabel: t("statusActive"),
                disabledLabel: t("statusDisabled"),
                actionsLabel: t("colActions"),
                cancelLabel: t("confirmNo"),
                columns,
                rows: props.members.map((member) => ({
                    id: member.userId,
                    name: member.displayName,
                    email: member.email,
                    isYou: member.userId === props.selfId,
                    staffNote: member.staffName === null ? undefined : t("linkedStaff", { name: member.staffName }),
                    roleLabel: t(ROLE_KEYS[member.role]),
                    isActive: member.isActive,
                    lastSignIn:
                        member.lastSignInAt === null
                            ? t("neverSignedIn")
                            : format.dateTime(new Date(member.lastSignInAt), {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                              }),
                    menuLabel: t("rowMore", { name: member.displayName }),
                    entries: canManageMember(props.selfRole, member) ? entriesFor(member) : [],
                })),
                isSkeleton: isLoading,
                isPending,
                error,
                confirm: confirmOf(),
            }}
            on={{
                cancelConfirm: () => setAsking(undefined),
                confirm: () => {
                    if (target === undefined || asking === undefined) return
                    run(() =>
                        asking.kind === "remove"
                            ? writeRemoveMember(command(target))
                            : writeMemberStatus({ ...command(target), status: "disabled" }),
                    )
                },
            }}
        />
    )
}
