"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryMemberGrants } from "@/modules/api/graphql/queries/query-member-grants"
import type { QueryMemberGrantsRequest } from "@/modules/api/graphql/queries/query-member-grants"

/** The SWR key of {@link useQueryMemberGrantsSwr}. */
export const QUERY_MEMBER_GRANTS_SWR_KEY = "QUERY_MEMBER_GRANTS_SWR"

/** The back end `memberGrants` query. Pass `null` to wait for the action. */
export const useQueryMemberGrantsSwr = (request: QueryMemberGrantsRequest | null, config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceRequestKey(QUERY_MEMBER_GRANTS_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryMemberGrantsRequest>) =>
            answeredData(await queryMemberGrants({ request: input }), QUERY_MEMBER_GRANTS_SWR_KEY).memberGrants,
        config,
    )
