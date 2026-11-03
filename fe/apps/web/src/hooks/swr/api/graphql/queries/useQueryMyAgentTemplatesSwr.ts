"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryMyAgentTemplates } from "@/modules/api/graphql/queries/query-my-agent-templates"

/** The SWR key of {@link useQueryMyAgentTemplatesSwr}. */
export const QUERY_MY_AGENT_TEMPLATES_SWR_KEY = "QUERY_MY_AGENT_TEMPLATES_SWR"

/** The back end `myAgentTemplates` query. */
export const useQueryMyAgentTemplatesSwr = (enabled = true) =>
    useSWR(
        useWorkspaceKey(QUERY_MY_AGENT_TEMPLATES_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryMyAgentTemplates({ signal })
            if (!result.data) throw new Error("myAgentTemplates answered no data")
            return result.data.myAgentTemplates
        },
    )
