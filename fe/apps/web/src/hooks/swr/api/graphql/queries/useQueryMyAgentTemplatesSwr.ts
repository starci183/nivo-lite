"use client"

import useSWR from "swr"
import { answeredData } from "@/hooks/workspaceread"
import type { SWRResponse } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import type { MyAgentTemplatesQuery } from "@/modules/api"
import { queryMyAgentTemplates } from "@/modules/api/graphql/queries/query-my-agent-templates"

/** The SWR key of {@link useQueryMyAgentTemplatesSwr}. */
export const QUERY_MY_AGENT_TEMPLATES_SWR_KEY = "QUERY_MY_AGENT_TEMPLATES_SWR"

/** The back end `myAgentTemplates` query. */
export const useQueryMyAgentTemplatesSwr = (
    enabled = true,
): SWRResponse<MyAgentTemplatesQuery["myAgentTemplates"], Error> =>
    useSWR(
        useWorkspaceKey(QUERY_MY_AGENT_TEMPLATES_SWR_KEY, [], enabled),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryMyAgentTemplates({ signal }), "myAgentTemplates").myAgentTemplates,
    )
