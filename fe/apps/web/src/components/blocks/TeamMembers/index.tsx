"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, canManageMember, teamSlotOf, useMemberCommands, useTeam } from "@/hooks/team"
import { useSlotLabels } from "@/hooks/slot"
import { TeamMembersBase } from "./component"
import type { Asking, MemberRowView } from "./types"
import { PLACEHOLDER_ROW, createTeamMembersActions } from "./controller"

/** Connects the workspace state and commands to the visual surface. */
export const TeamMembers = () => {
    const t = useTranslations("team")
    const format = useFormatter()
    const member = useMember()
    const selfRole = member?.role ?? "staff"
    const selfId = member?.userId ?? ""
    const isAllowed = member !== null && isTeamManager(member.role)
    const slotLabels = useSlotLabels()
    const team = useTeam(member?.workspaceId ?? "", isAllowed)
    const commands = useMemberCommands()
    const [asking, setAsking] = useState<Asking>()
    const context = createTeamMembersActions({
        t,
        format,
        member,
        selfRole,
        selfId,
        isAllowed,
        team,
        slotLabels,
        commands,
        asking,
        setAsking,
    })

    if (!isAllowed) return null
    return <TeamMembersBase {...createTeamMembersView(context)} />
}

const createTeamMembersView = (
    context: ReturnType<typeof createTeamMembersActions>,
): React.ComponentProps<typeof TeamMembersBase> => {
    const {
        t,
        format,
        selfRole,
        selfId,
        team,
        slotLabels,
        commands,
        asking,
        setAsking,
        run,
        entriesFor,
        target,
        confirmOf,
        columns,
    } = context
    return {
        props: {
            title: t("membersTitle"),
            description: team.isLoading ? undefined : t("membersDesc", { count: team.views.members.length }),
            youLabel: t("you"),
            activeLabel: t("statusActive"),
            disabledLabel: t("statusDisabled"),
            actionsLabel: t("colActions"),
            cancelLabel: t("confirmNo"),
            columns,
            slot: teamSlotOf(
                team,
                team.views.members.map((row): MemberRowView => ({
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
            ),
            placeholder: [PLACEHOLDER_ROW],
            slotLabels: slotLabels(t("membersTitle")),
            isPending: commands.isPending,
            confirm: confirmOf(),
        },
        on: {
            retry: team.reload,
            cancelConfirm: () => setAsking(undefined),
            confirm: () => {
                if (target === undefined || asking === undefined) return
                void run(() =>
                    asking.kind === "remove"
                        ? commands.remove(target.userId)
                        : commands.setStatus(target.userId, "disabled"),
                )
            },
        },
    }
}
