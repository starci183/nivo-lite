"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMember } from "@/hooks/member"
import { ROLE_KEYS, isTeamManager, canManageMember, teamSlotOf, useTeam, useTeamMemberActions } from "@/hooks/team"
import { useSlotLabels } from "@/hooks/slot"
import type { MemberRowView } from "@/modules/types"
import { TeamMembersBase, type TeamMembersBaseProps } from "./component"

/** The one blank member row the skeleton draws while the team is read. */
const PLACEHOLDER_ROW: MemberRowView = {
    id: "-",
    name: "-",
    email: "-",
    isYou: false,
    roleLabel: "-",
    isActive: true,
    lastSignIn: "-",
    menuLabel: "-",
    entries: [],
}

/** The connected members table: change a role, disable or enable access, remove (after a yes), through the back end GraphQL API (outcome toasted). */
export const TeamMembers = () => {
    const t = useTranslations("team")
    const format = useFormatter()
    const member = useMember()
    const selfRole = member?.role ?? "staff"
    const selfId = member?.userId ?? ""
    const isAllowed = member !== null && isTeamManager(member.role)
    const slotLabels = useSlotLabels()
    const team = useTeam(member?.workspaceId ?? "", isAllowed)
    const actions = useTeamMemberActions(team.views.members, selfRole, selfId)

    if (!isAllowed) return null
    const rows = team.views.members.map((row): MemberRowView => ({
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
        entries: canManageMember(selfRole, row) ? actions.entriesFor(row) : [],
    }))
    const view: TeamMembersBaseProps = {
        props: {
            title: t("membersTitle"),
            description: team.isLoading ? undefined : t("membersDesc", { count: team.views.members.length }),
            youLabel: t("you"),
            activeLabel: t("statusActive"),
            disabledLabel: t("statusDisabled"),
            actionsLabel: t("colActions"),
            cancelLabel: t("confirmNo"),
            columns: actions.columns,
            slot: teamSlotOf(team, rows),
            placeholder: [PLACEHOLDER_ROW],
            slotLabels: slotLabels(t("membersTitle")),
            isPending: actions.isPending,
            confirm: actions.confirm,
        },
        on: { retry: team.reload, cancelConfirm: actions.cancelConfirm, confirm: actions.acceptConfirm },
    }
    return <TeamMembersBase {...view} />
}
