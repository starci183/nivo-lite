"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import {
    queryAgentChannelChoices,
    type QueryAgentChannelChoicesRequest,
} from "@/modules/api/graphql/queries/query-agent-channel-choices"
import type { AgentChannelChoicesQuery } from "@/modules/api"

/** The SWR key of {@link useQueryAgentChannelChoicesSwr}. */
export const QUERY_AGENT_CHANNEL_CHOICES_SWR_KEY = "QUERY_AGENT_CHANNEL_CHOICES_SWR"

/** The back end `agentChannelChoices` query. Pass `null` to wait for the role. */
export const useQueryAgentChannelChoicesSwr = (
    request: QueryAgentChannelChoicesRequest | null,
    config?: SWRConfiguration,
): ReadResponse<AgentChannelChoicesQuery["agentChannelChoices"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_AGENT_CHANNEL_CHOICES_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryAgentChannelChoicesRequest>) =>
            answeredData(await queryAgentChannelChoices({ request: input }), QUERY_AGENT_CHANNEL_CHOICES_SWR_KEY)
                .agentChannelChoices,
        config,
    )
