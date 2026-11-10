"use client"

import useSWRMutation from "swr/mutation"
import { mutatePublishAgentWorkflowVersion, type MutatePublishAgentWorkflowVersionRequest } from "@/modules/api/graphql/mutations/mutation-publish-agent-workflow-version"
import type { SWRMutationResponse } from "swr/mutation"
import type { PublishAgentWorkflowVersionMutation } from "@/modules/api"

/** What the PublishAgentWorkflowVersion mutation is triggered with. */
interface PublishAgentWorkflowVersionArg {
    readonly arg: MutatePublishAgentWorkflowVersionRequest
}

/** The SWR key of {@link useMutatePublishAgentWorkflowVersionSwr}. */
export const MUTATE_PUBLISH_AGENT_WORKFLOW_VERSION_SWR_KEY = "MUTATE_PUBLISH_AGENT_WORKFLOW_VERSION_SWR"

/** SWR mutation for {@link mutatePublishAgentWorkflowVersion}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutatePublishAgentWorkflowVersionSwr = (): SWRMutationResponse<PublishAgentWorkflowVersionMutation["publishAgentWorkflowVersion"], Error, typeof MUTATE_PUBLISH_AGENT_WORKFLOW_VERSION_SWR_KEY, PublishAgentWorkflowVersionArg["arg"]> =>
    useSWRMutation(MUTATE_PUBLISH_AGENT_WORKFLOW_VERSION_SWR_KEY, async (_key: string, { arg }: PublishAgentWorkflowVersionArg) => {
        const result = await mutatePublishAgentWorkflowVersion({ request: arg })
        if (!result.data) throw new Error("publishAgentWorkflowVersion answered no data")
        return result.data.publishAgentWorkflowVersion
    })
