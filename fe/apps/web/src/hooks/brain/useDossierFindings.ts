"use client"

import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryDossierFindingsSwr, useQueryWorkspaceMembersSwr } from "@/hooks/swr"
import type { DossierFindingsFilter } from "@/hooks/swr"
import { useViewerKeyId } from "@/hooks/workspaceKey"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { findingViewOf, memberOptionsOf } from "@/modules/brain"
import type { FindingsQuery, FindingView, MemberOption } from "@/modules/brain"
import type { DataSlot } from "@/modules/types"

/** The wire filter of a read in the words of the domain; `mine` waits for the viewer, so it answers null until the viewer is known. */
const filterOf = (query: FindingsQuery, viewerId: string | undefined): DossierFindingsFilter | null => {
    if (query.assignee === "mine" && viewerId === undefined) return null
    return {
        ...(query.dossierId === undefined ? {} : { dossierId: query.dossierId }),
        statuses: [...query.statuses],
        ...(query.severities === undefined ? {} : { severities: [...query.severities] }),
        ...(query.assignee === "mine" && viewerId !== undefined ? { assigneeId: viewerId } : {}),
        ...(query.assignee === "unassigned" ? { unassigned: true } : {}),
        ...(query.draftsAwaiting === true ? { draftsAwaiting: true } : {}),
    }
}

/** What a list of findings gives its block. */
interface DossierFindings {
    readonly slot: DataSlot<ReadonlyArray<FindingView>>
    readonly hasNextPage: boolean
    readonly isLoadingMore: boolean
    /** A page after the first failed: the rows stay and the block offers a retry. */
    readonly hasPageFailure: boolean
    readonly loadMore: () => void
    readonly retry: () => void
    /** The active members of the workspace, for the assignee list and the names of assignees. */
    readonly members: ReadonlyArray<MemberOption>
}

/**
 * The findings of the dossier review that match a read, a page at a time, with the members of the workspace who may be given
 * one. The viewer's own findings wait until the viewer is known, and nothing is read while `isEnabled` is false. A new `revision`
 * (a review run ending) reads the findings again.
 */
export const useDossierFindings = (query: FindingsQuery, isEnabled = true, revision = ""): DossierFindings => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const viewerId = useViewerKeyId()
    const filter = filterOf(query, viewerId)
    const read = useQueryDossierFindingsSwr(
        filter === null || !isEnabled ? undefined : activeWorkspaceId,
        filter ?? {},
        revision,
    )
    const people = useQueryWorkspaceMembersSwr(activeWorkspaceId)
    const members = useMemo(() => memberOptionsOf(people.data ?? []), [people.data])
    const views = useMemo(
        () =>
            read.data === undefined
                ? undefined
                : read.data.flatMap((record) => {
                      const view = findingViewOf(record)
                      return view === undefined ? [] : [view]
                  }),
        [read.data],
    )
    const slot =
        filter === null && isEnabled
            ? { isLoading: true }
            : slotOfSwr({ data: views, error: read.error, isLoading: read.isLoading })
    return {
        slot,
        hasNextPage: read.hasNextPage,
        isLoadingMore: read.isLoadingMore,
        hasPageFailure: read.paginationError !== undefined,
        loadMore: read.loadMore,
        retry: read.retry,
        members,
    }
}
