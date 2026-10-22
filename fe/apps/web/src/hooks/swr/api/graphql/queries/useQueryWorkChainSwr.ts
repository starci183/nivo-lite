"use client"

import { answeredData, workspaceArgumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useAppSelector } from "@/redux"
import { queryWorkChain } from "@/modules/api/graphql/queries/query-work-chain"
import type { QueryWorkChainRequest } from "@/modules/api/graphql/queries/query-work-chain"

/** The SWR key of {@link useQueryWorkChainSwr}. */
export const QUERY_WORK_CHAIN_SWR_KEY = "QUERY_WORK_CHAIN_SWR"

/** The back end `workChain` query. Pass `null` to wait for the arguments. */
export const useQueryWorkChainSwr = (request: QueryWorkChainRequest | null, config?: SWRConfiguration) => {
    const workspaceId = useAppSelector((state) => state.workspace.activeWorkspaceId)
    const read = async ([, , input]: readonly [string, string, QueryWorkChainRequest]) =>
        answeredData(await queryWorkChain({ request: input }), QUERY_WORK_CHAIN_SWR_KEY).workChain
    return useSWR(workspaceArgumentKey(QUERY_WORK_CHAIN_SWR_KEY, workspaceId, request ?? undefined), read, config)
}
