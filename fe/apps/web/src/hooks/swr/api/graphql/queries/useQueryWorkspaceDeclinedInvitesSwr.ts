"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { argumentKey, answeredData } from "@/hooks/workspaceread"
import { queryWorkspaceDeclinedInvites } from "@/modules/api/graphql/queries/query-workspace-declined-invites"
import type { WorkspaceDeclinedInvitesQuery } from "@/modules/api"

/** The SWR key of the declined invitations of the active workspace. */
export const QUERY_WORKSPACE_DECLINED_INVITES_SWR_KEY = "QUERY_WORKSPACE_DECLINED_INVITES_SWR"

/** Reads the declined invitations once; a missing answer is a failure. */
const readDeclined = async (): Promise<WorkspaceDeclinedInvitesQuery["workspaceDeclinedInvites"]> =>
    answeredData(await queryWorkspaceDeclinedInvites(), QUERY_WORKSPACE_DECLINED_INVITES_SWR_KEY)
        .workspaceDeclinedInvites

/** The invitations of the active workspace the invited people declined lately; no read while none is named. */
export const useQueryWorkspaceDeclinedInvitesSwr = (
    workspaceId: string | undefined,
): SWRResponse<WorkspaceDeclinedInvitesQuery["workspaceDeclinedInvites"], Error> =>
    useSWR(argumentKey(QUERY_WORKSPACE_DECLINED_INVITES_SWR_KEY, workspaceId), readDeclined)
