"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryOfficeCommandCandidates } from "@/modules/api/graphql/queries/query-office-command-candidates"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of {@link useQueryOfficeCommandCandidatesSwr}. */
export const QUERY_OFFICE_COMMAND_CANDIDATES_SWR_KEY = "QUERY_OFFICE_COMMAND_CANDIDATES_SWR"

/** The back end `officeCommandCandidates` query. */
export const useQueryOfficeCommandCandidatesSwr = (
    config?: SWRConfiguration,
): ReadResponse<OperationData<typeof queryOfficeCommandCandidates>["officeCommandCandidates"] | undefined> =>
    useSWR(
        useWorkspaceKey(QUERY_OFFICE_COMMAND_CANDIDATES_SWR_KEY, []),
        async () => (await queryOfficeCommandCandidates()).data?.officeCommandCandidates,
        config,
    )
