"use client"

import { useMemo, useState } from "react"
import { useQueryWorkspaceInvitesSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceInvitesSwr"
import { useQueryWorkspaceMembersSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceMembersSwr"
import { useQueryWorkspaceStaffSwr } from "@/hooks/swr/api/graphql/queries/useQueryWorkspaceStaffSwr"
import { teamViews } from "./team.shared"
import type { TeamViews } from "./team.shared"

/** The team of a workspace as the page draws it. */
export interface TeamState {
    readonly views: TeamViews
    /** True until the first answer of all three reads. */
    readonly isLoading: boolean
    /** The first failure of the three reads, in the back end words. */
    readonly error: string | undefined
}

const EMPTY: TeamViews = { members: [], invites: [], staffChoices: [] }

/** Reads the members, the open invitations and the staff rows of a workspace (`enabled` is false for a person who may not see them). */
export const useTeam = (workspaceId: string, enabled: boolean): TeamState => {
    const id = enabled ? workspaceId : undefined
    const members = useQueryWorkspaceMembersSwr(id)
    const invites = useQueryWorkspaceInvitesSwr(id)
    const staff = useQueryWorkspaceStaffSwr(id)
    const [now] = useState(() => Date.now())
    const failure = [members.error, invites.error, staff.error].find((error): error is Error => error instanceof Error)
    const views = useMemo(
        () =>
            members.data === undefined || invites.data === undefined || staff.data === undefined
                ? EMPTY
                : teamViews(members.data, invites.data, staff.data, now),
        [members.data, invites.data, staff.data, now],
    )
    return {
        views,
        isLoading: enabled && failure === undefined && (members.isLoading || invites.isLoading || staff.isLoading),
        error: failure?.message,
    }
}
