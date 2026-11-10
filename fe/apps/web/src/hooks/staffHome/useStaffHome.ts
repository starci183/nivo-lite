"use client"

import { useInboxLeads } from "@/hooks/inbox/useInboxLeads"
import { useInboxWords } from "@/hooks/inbox/useInboxWords"
import { useMember } from "@/hooks/member"
import { useQueryChatUnreadSwr, useQueryDossierFindingsSwr, useQueryMyWorkInHandSwr } from "@/hooks/swr"
import { useTeamChatRooms } from "@/hooks/teamChat/useTeamChatRooms"
import { useWorkspaceId } from "@/hooks/workspaces"
import { ALL_OPTION } from "@/modules/inbox"
import { brainDossierHref, brainTabHref } from "@/modules/routes"
import type { InboxLeadRowView, TeamChatRoomRow } from "@/modules/types"

/** How many rows each list of the staff home shows. */
const HOME_ROWS = 5

/** The findings still open or confirmed: the ones that are somebody's work. */
const OPEN_FINDINGS: ReadonlyArray<string> = ["open", "confirmed"]

/** One finding of the review that was given to the person, with the place it opens in. */
export interface StaffHomeFinding {
    readonly id: string
    readonly title: string
    /** The dossier it is about, or null. */
    readonly dossierName: string | null
    /** The path inside the workspace that opens it. */
    readonly path: string
}

/** What the staff home is drawn from. A count is undefined until it is read. */
export interface StaffHomeData {
    /** Open work items given to the person. */
    readonly assigned: number | undefined
    /** Customers who wait for a person. */
    readonly needsYou: number | undefined
    /** Customers who wrote for the first time today. */
    readonly newToday: number | undefined
    /** Unread chat messages. */
    readonly unread: number | undefined
    readonly findings: ReadonlyArray<StaffHomeFinding>
    readonly rooms: ReadonlyArray<TeamChatRoomRow>
    /** The customers whose latest input came today. */
    readonly leads: ReadonlyArray<InboxLeadRowView>
    readonly isWorkLoading: boolean
    readonly isChatsLoading: boolean
    readonly isLeadsLoading: boolean
}

/** The staff home of the open workspace: the work in hand, the recent chats, today's customers, read from the queries the pages already use. */
export const useStaffHome = (): StaffHomeData => {
    const workspaceId = useWorkspaceId()
    const userId = useMember()?.userId
    const { words } = useInboxWords()
    const assigned = useQueryMyWorkInHandSwr(workspaceId)
    const findings = useQueryDossierFindingsSwr(
        userId === undefined ? undefined : workspaceId,
        { assigneeId: userId ?? "", statuses: [...OPEN_FINDINGS] },
    )
    const leads = useInboxLeads(
        { tab: "all", query: "", search: "", channel: ALL_OPTION, agent: ALL_OPTION, sort: "recent", selectedId: null },
        words,
    )
    const rooms = useTeamChatRooms({ roomId: null, withAgentId: null })
    const unread = useQueryChatUnreadSwr(workspaceId)
    const isLeadsLoading = leads.status === "loading"
    const roomRows = "items" in rooms.slot ? rooms.slot.items : []
    return {
        assigned: assigned.data,
        needsYou: isLeadsLoading ? undefined : leads.list.tabs.find((tab) => tab.id === "needs_you")?.count,
        newToday: isLeadsLoading ? undefined : leads.list.newToday,
        unread: unread.data?.total,
        findings: (findings.data ?? []).slice(0, HOME_ROWS).map((finding) => ({
            id: finding.id,
            title: finding.title,
            dossierName: finding.dossierName,
            path:
                finding.dossierId === null
                    ? brainTabHref("dossiers")
                    : brainDossierHref(finding.dossierId, { finding: finding.id }),
        })),
        rooms: roomRows.slice(0, HOME_ROWS),
        leads: leads.list.rows.filter((row) => row.section === "today").slice(0, HOME_ROWS),
        isWorkLoading: assigned.isLoading || findings.isLoading,
        isChatsLoading: rooms.isLoading,
        isLeadsLoading,
    }
}
