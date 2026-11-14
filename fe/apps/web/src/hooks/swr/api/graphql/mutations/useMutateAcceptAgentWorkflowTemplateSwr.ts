"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import { mutateAcceptAgentWorkflowTemplate, type MutateAcceptAgentWorkflowTemplateRequest } from "@/modules/api/graphql/mutations/mutation-accept-agent-workflow-template"
import type { AcceptAgentWorkflowTemplateMutation } from "@/modules/api"

/** What the AcceptAgentWorkflowTemplate mutation is triggered with. */
interface AcceptAgentWorkflowTemplateArg {
    readonly arg: MutateAcceptAgentWorkflowTemplateRequest
}

/** The SWR key of {@link useMutateAcceptAgentWorkflowTemplateSwr}. */
export const MUTATE_ACCEPT_AGENT_WORKFLOW_TEMPLATE_SWR_KEY = "MUTATE_ACCEPT_AGENT_WORKFLOW_TEMPLATE_SWR"

/** SWR mutation for {@link mutateAcceptAgentWorkflowTemplate}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateAcceptAgentWorkflowTemplateSwr = (): SWRMutationResponse<AcceptAgentWorkflowTemplateMutation["acceptAgentWorkflowTemplate"], Error, typeof MUTATE_ACCEPT_AGENT_WORKFLOW_TEMPLATE_SWR_KEY, AcceptAgentWorkflowTemplateArg["arg"]> =>
    useSWRMutation(MUTATE_ACCEPT_AGENT_WORKFLOW_TEMPLATE_SWR_KEY, async (_key: string, { arg }: AcceptAgentWorkflowTemplateArg) => {
        const result = await mutateAcceptAgentWorkflowTemplate({ request: arg })
        if (!result.data) throw new Error("acceptAgentWorkflowTemplate answered no data")
        return result.data.acceptAgentWorkflowTemplate
    })
