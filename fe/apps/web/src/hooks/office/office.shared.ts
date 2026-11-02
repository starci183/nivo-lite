"use client"

import { mutate } from "@/modules/viewer-cache"
import { canDecideItem, type ShellMember } from "@/hooks/member"

import {
    QUERY_OFFICE_COMMAND_CANDIDATES_SWR_KEY,
    QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY,
    QUERY_OFFICE_MESSAGES_SWR_KEY,
    QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY,
    QUERY_OFFICE_ROOMS_SWR_KEY,
    QUERY_WORK_ITEMS_SWR_KEY,
} from "@/hooks/swr"
import type {
    OfficeAgent,
    OfficeApproval,
    OfficeCandidate,
    OfficeContext,
    OfficeLead,
    OfficePerson,
    OfficeStaff,
    OfficeTask,
    OfficeWork,
} from "@/modules/office"

/** An authoritative SWR read retained by the hook that owns it; status is folded only by shared slot builders. */
export interface OfficeRead<T = unknown> {
    readonly data: T | undefined
    readonly error: unknown
    readonly isLoading: boolean
    readonly isValidating?: boolean
}

/** The board's ready projections, with each authoritative read retained for the region that draws it. */
export interface OfficeBoard {
    readonly pending: ReadonlyArray<OfficeApproval>
    readonly decided: ReadonlyArray<OfficeApproval>
    readonly candidates: ReadonlyArray<OfficeCandidate>
    /** Open work that has no approval card of its own, oldest first. */
    readonly exceptions: ReadonlyArray<OfficeWork>
    /** Work a person decided and that has no approval card: kept in the thread as a record. */
    readonly decidedCards: ReadonlyArray<OfficeWork>
    readonly agents: ReadonlyArray<OfficeAgent>
    readonly people: ReadonlyArray<OfficePerson>
    readonly staff: ReadonlyArray<OfficeStaff>
    readonly leads: ReadonlyArray<OfficeLead>
    readonly tasks: ReadonlyArray<OfficeTask>
    readonly teamReads: ReadonlyArray<OfficeRead>
    readonly composerReads: ReadonlyArray<OfficeRead>
    readonly approvalReads: ReadonlyArray<OfficeRead>
    readonly workReads: ReadonlyArray<OfficeRead>
    readonly reload: () => void
    readonly reloadTeam: () => void
}

const OFFICE_KEYS: ReadonlySet<string> = new Set([
    QUERY_OFFICE_MESSAGES_SWR_KEY,
    QUERY_OFFICE_PENDING_APPROVALS_SWR_KEY,
    QUERY_OFFICE_ROOMS_SWR_KEY,
    QUERY_OFFICE_DECIDED_APPROVALS_SWR_KEY,
    QUERY_OFFICE_COMMAND_CANDIDATES_SWR_KEY,
    QUERY_OFFICE_ROOMS_SWR_KEY,
    QUERY_WORK_ITEMS_SWR_KEY,
])

const isOfficeKey = (key: unknown): boolean => {
    const head: unknown = Array.isArray(key) ? key[0] : key
    return typeof head === "string" && OFFICE_KEYS.has(head)
}

/** Reads the thread, the approvals, the command cards and the work items again. */
export const refreshOffice = (): Promise<unknown> => mutate(isOfficeKey)

/** Who is signed in, who is around and what is focused, for the views. */
export const contextOf = (
    me: ShellMember | null,
    board: OfficeBoard,
    focusedId: string | null,
    alreadyIds: ReadonlyArray<string>,
): OfficeContext => ({
    meName: me?.name ?? null,
    meUserId: me?.userId ?? null,
    canDecide: (assignedStaffId) => canDecideItem(me, assignedStaffId),
    agents: board.agents,
    staff: board.staff,
    leads: board.leads,
    nowIso: new Date().toISOString(),
    workModules: new Map([...board.exceptions, ...board.decidedCards].map((work) => [work.id, work.department])),
    focusedId,
    alreadyIds,
})
