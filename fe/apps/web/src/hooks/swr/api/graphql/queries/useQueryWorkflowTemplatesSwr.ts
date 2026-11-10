"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryWorkflowTemplates, type QueryWorkflowTemplatesRequest } from "@/modules/api/graphql/queries/query-workflow-templates"
import type { WorkflowTemplatesQuery } from "@/modules/api"

/** The SWR key of {@link useQueryWorkflowTemplatesSwr}. */
export const QUERY_WORKFLOW_TEMPLATES_SWR_KEY = "QUERY_WORKFLOW_TEMPLATES_SWR"

/** The back end `workflowTemplates` query. Pass `null` to wait for the arguments. */
export const useQueryWorkflowTemplatesSwr = (
    request: QueryWorkflowTemplatesRequest | null,
    config?: SWRConfiguration,
): ReadResponse<WorkflowTemplatesQuery["workflowTemplates"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_WORKFLOW_TEMPLATES_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryWorkflowTemplatesRequest>) =>
            answeredData(await queryWorkflowTemplates({ request: input }), QUERY_WORKFLOW_TEMPLATES_SWR_KEY).workflowTemplates,
        config,
    )
