"use client"

import { answeredData, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceRequestKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { queryWorkflowTemplate, type QueryWorkflowTemplateRequest } from "@/modules/api/graphql/queries/query-workflow-template"
import type { WorkflowTemplateQuery } from "@/modules/api"

/** The SWR key of {@link useQueryWorkflowTemplateSwr}. */
export const QUERY_WORKFLOW_TEMPLATE_SWR_KEY = "QUERY_WORKFLOW_TEMPLATE_SWR"

/** The back end `workflowTemplate` query. Pass `null` to wait for the arguments. */
export const useQueryWorkflowTemplateSwr = (
    request: QueryWorkflowTemplateRequest | null,
    config?: SWRConfiguration,
): ReadResponse<WorkflowTemplateQuery["workflowTemplate"]> =>
    useSWR(
        useWorkspaceRequestKey(QUERY_WORKFLOW_TEMPLATE_SWR_KEY, request),
        async ([, , input]: WorkspaceReadKey<QueryWorkflowTemplateRequest>) =>
            answeredData(await queryWorkflowTemplate({ request: input }), QUERY_WORKFLOW_TEMPLATE_SWR_KEY).workflowTemplate,
        config,
    )
