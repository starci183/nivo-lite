"use client"

import useSWR from "swr"
import type { SWRResponse } from "swr"
import { argumentKey, answeredData } from "@/hooks/workspaceread"
import { queryMyWorkInHand } from "@/modules/api/graphql/queries/query-my-work-in-hand"
import { GraphQLHeadersKey } from "@/modules/api"

/** The SWR key of the work the person has in hand in one workspace. */
export const QUERY_MY_WORK_IN_HAND_SWR_KEY = "QUERY_MY_WORK_IN_HAND_SWR"

/** How many open work items are assigned to the signed-in person in the workspace; no read while none is named. */
export const useQueryMyWorkInHandSwr = (workspaceId: string | undefined): SWRResponse<number, Error> =>
    useSWR(argumentKey(QUERY_MY_WORK_IN_HAND_SWR_KEY, workspaceId), async () =>
        workspaceId === undefined
            ? 0
            : answeredData(
                  await queryMyWorkInHand({ headers: { [GraphQLHeadersKey.XWorkspaceId]: workspaceId } }),
                  QUERY_MY_WORK_IN_HAND_SWR_KEY,
              ).myWorkInHand,
    )
