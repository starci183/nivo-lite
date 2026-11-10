"use client"

import useSWRMutation from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_INBOX_LEAD_SWR_KEY } from "../queries/useQueryInboxLeadSwr"
import { QUERY_INBOX_LEADS_SWR_KEY } from "../queries/useQueryInboxLeadsSwr"
import {
    mutateAssignInboxLead,
    type mutateAssignInboxLead as AssignInboxLeadOperation,
} from "@/modules/api/graphql/mutations/mutation-assign-inbox-lead"
import type { SWRMutationResponse } from "swr/mutation"
import type { AssignInboxLeadMutation } from "@/modules/api"

/** The request of the AssignInboxLead operation. */
type AssignInboxLeadArg = Parameters<typeof AssignInboxLeadOperation>[0]["request"]

/** What the AssignInboxLead mutation is triggered with. */
interface TriggerArg {
    readonly arg: AssignInboxLeadArg
}

/** The SWR identity of the AssignInboxLead mutation. */
export const MUTATE_ASSIGN_INBOX_LEAD_SWR_KEY = "MUTATE_ASSIGN_INBOX_LEAD_SWR"

/** Hands one customer to an agent; the list and the opened customer read the new owner. */
export const useMutateAssignInboxLeadSwr = (
    workspaceId: string,
): SWRMutationResponse<
    AssignInboxLeadMutation["assignInboxLead"] | undefined,
    Error,
    [string, string],
    AssignInboxLeadArg
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_ASSIGN_INBOX_LEAD_SWR_KEY, workspaceId],
        ([, scope]: [string, string], { arg }: TriggerArg) =>
            mutateAssignInboxLead({ request: arg, headers: { "X-Workspace-Id": scope } }).then(
                (result) => result.data?.assignInboxLead,
            ),
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_INBOX_LEADS_SWR_KEY))
                void mutate(matchesSwrKey(QUERY_INBOX_LEAD_SWR_KEY))
            },
        },
    )
}
