"use client"

import useSWR from "swr"
import { useViewerKey } from "@/hooks/workspaceKey"
import { queryMyPendingInvites } from "@/modules/api/graphql/queries/query-my-pending-invites"
import { answeredData } from "@/hooks/workspaceread"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { MyPendingInvitesQuery } from "@/modules/api"

/** The SWR key of the pending invitations of the signed-in person; accepting or declining one revalidates it. */
export const QUERY_MY_PENDING_INVITES_SWR_KEY = "QUERY_MY_PENDING_INVITES_SWR"

/** The pending invitations to the signed-in person's email (the back end `myPendingInvites` query). */
export const useQueryMyPendingInvitesSwr = (): ReadResponse<MyPendingInvitesQuery["myPendingInvites"]> =>
    useSWR(useViewerKey(QUERY_MY_PENDING_INVITES_SWR_KEY), readMyPendingInvites)

/** Reads the pending invitations once; a missing answer is a failure, never an empty list. */
const readMyPendingInvites = async ({ signal }: ReadContext = {}): Promise<MyPendingInvitesQuery["myPendingInvites"]> =>
    answeredData(await queryMyPendingInvites({ signal }), QUERY_MY_PENDING_INVITES_SWR_KEY).myPendingInvites

/** What SWR hands a read: the signal that aborts it. */
interface ReadContext {
    readonly signal?: AbortSignal
}
