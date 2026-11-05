"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { isTeamManager, teamSlotOf, useTeam } from "@/hooks/team"
import type { TeamRole, useInviteInteraction } from "@/hooks/team"
import { inviteDetailOf, listRowsOf, memberDetailOf, panesDataOf } from "./teamPanes.shared"
import type { DataSlot, TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamPanesData = Extract<TeamPanesBaseProps["props"]["slot"], { readonly items: unknown }>["items"]

/** What the team panes read and how the person narrowed and opened it. */
export interface TeamPanesState {
    readonly isManager: boolean
    readonly selfRole: TeamRole
    readonly team: ReturnType<typeof useTeam>
    readonly slot: DataSlot<TeamPanesData>
    readonly query: string
    readonly filter: string
    readonly selectedId: string | null
    readonly setQuery: (value: string) => void
    readonly setFilter: (value: string) => void
    readonly select: (id: string) => void
}

/**
 * The team of the workspace as the panes draw it: the rows after the search and the filter, the opened record (the first row when
 * none was chosen) and the one slot of the three reads, so every region of the panes loads and fails together.
 */
export const useTeamPanesData = (interaction: ReturnType<typeof useInviteInteraction>): TeamPanesState => {
    const t = useTranslations("team")
    const format = useFormatter()
    const member = useMember()
    const selfRole = member?.role ?? "staff"
    const selfId = member?.userId ?? ""
    const isManager = member !== null && isTeamManager(member.role)
    const team = useTeam(member?.workspaceId ?? "", isManager)
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState("all")
    const [chosen, setChosen] = useState<string | null>(null)
    const viewer = { role: selfRole, id: selfId }
    const busy = {
        id: interaction.busyId,
        action: interaction.busyAction,
        isPending: interaction.commands.isPending,
        shown: interaction.shown,
    }
    const all = listRowsOf(t, format, team.views.members, team.views.invites, viewer)
    const data = panesDataOf({
        rows: all,
        filter,
        query,
        members: team.views.members.map((row) => memberDetailOf(t, format, row, viewer)),
        invites: team.views.invites.map((row) => inviteDetailOf(t, format, row, busy)),
    })
    const selectedId = data.rows.some((row) => row.id === chosen) ? chosen : (data.rows[0]?.id ?? null)
    return {
        isManager,
        selfRole,
        team,
        slot: teamSlotOf(team, data),
        query,
        filter,
        selectedId,
        setQuery,
        setFilter,
        select: setChosen,
    }
}
