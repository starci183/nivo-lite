"use client"

import { answeredData, workspaceArgumentKey, type ReadResponse } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryWorkChain, type QueryWorkChainRequest } from "@/modules/api/graphql/queries/query-work-chain"
import type { WorkChainQuery } from "@/modules/api"

/** The SWR key of {@link useQueryWorkChainSwr}. */
export const QUERY_WORK_CHAIN_SWR_KEY = "QUERY_WORK_CHAIN_SWR"

/** The back end `workChain` query. Pass `null` to wait for the arguments. */
export const useQueryWorkChainSwr = (
    request: QueryWorkChainRequest | null,
    config?: SWRConfiguration,
): ReadResponse<WorkChainQuery["workChain"]> => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const read = async ([, , input]: readonly [string, string, QueryWorkChainRequest]) =>
        answeredData(await queryWorkChain({ request: input }), QUERY_WORK_CHAIN_SWR_KEY).workChain
    return useSWR(workspaceArgumentKey(QUERY_WORK_CHAIN_SWR_KEY, workspaceId, request ?? undefined), read, config)
}
