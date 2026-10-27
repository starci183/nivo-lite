import type { useFormatter, useTranslations } from "next-intl"
import type { DataTableColumn, DropdownMenuEntry } from "@starci/grammar/common"
import type { useMember } from "@/hooks/member"
import { ROLE_KEYS, roleChoices } from "@/hooks/team"
import type { TeamMemberView, useMemberCommands, useTeam } from "@/hooks/team"
import type { useSlotLabels } from "@/hooks/slot"
import type { Asking, MemberRowView } from "./types"

/** State values and commands consumed by the connected surface. */
export type TeamMembersControllerInput = {
    readonly t: ReturnType<typeof useTranslations<"team">>
    readonly format: ReturnType<typeof useFormatter>
    readonly member: ReturnType<typeof useMember>
    readonly selfRole: NonNullable<NonNullable<ReturnType<typeof useMember>>["role"]>
    readonly selfId: NonNullable<NonNullable<ReturnType<typeof useMember>>["userId"]>
    readonly isAllowed: boolean
    readonly team: ReturnType<typeof useTeam>
    readonly slotLabels: ReturnType<typeof useSlotLabels>
    readonly commands: ReturnType<typeof useMemberCommands>
    readonly asking: Asking | undefined
    readonly setAsking: React.Dispatch<React.SetStateAction<Asking | undefined>>
}

/** The one blank member row the skeleton draws while the team is read. */
export const PLACEHOLDER_ROW: MemberRowView = {
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

/** A remove or a disable waiting for the person's yes. */

/** The connected members table: change a role, disable or enable access, remove (after a yes), through the back end GraphQL API (outcome toasted). */
const createTeamMembersState = (input: TeamMembersControllerInput) => {
    const { setAsking } = input

    const run = async (job: () => Promise<boolean>) => {
        await job()
        setAsking(undefined)
    }
    return { ...input, run }
}

const createTeamMembersDetails = (input: TeamMembersControllerInput) => {
    const context = createTeamMembersState(input)
    const { t, selfRole, selfId, team, commands, asking, setAsking, run } = context

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
                        tone: "danger",
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
    const target = team.views.members.find((row) => row.userId === asking?.userId)
    return { ...context, entriesFor, columns, target }
}

/** Builds the row menus, the columns and the confirm question from the controller input. */
export const createTeamMembersActions = (input: TeamMembersControllerInput) => {
    const context = createTeamMembersDetails(input)
    const { t, asking, target } = context

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
    return { ...context, confirmOf }
}
