"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateUpdateAutomationPipeline,
    type MutateUpdateAutomationPipelineRequest,
} from "@/modules/api/graphql/mutations/mutation-update-automation-pipeline"
import { automationCardViewOf } from "@/modules/automations"
import type { SWRMutationResponse } from "swr/mutation"

/** What the UpdateAutomationPipeline mutation is triggered with. */
interface UpdateAutomationPipelineArg {
    readonly arg: MutateUpdateAutomationPipelineRequest
}

/** The SWR key of the update automation pipeline mutation. */
export const MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR_KEY = "MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR"

/** SWR mutation for {@link mutateUpdateAutomationPipeline}: `trigger({ templateKey, ...patch })` answers the card as it stands afterwards. */
export const useMutateUpdateAutomationPipelineSwr = (): SWRMutationResponse<
    ReturnType<typeof automationCardViewOf>,
    Error,
    typeof MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR_KEY,
    UpdateAutomationPipelineArg["arg"]
> =>
    useSWRMutation(
        MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR_KEY,
        async (_key: string, { arg }: UpdateAutomationPipelineArg) => {
            const result = await mutateUpdateAutomationPipeline({ request: arg })
            if (!result.data) throw new Error("updateAutomationPipeline answered no data")
            return automationCardViewOf(result.data.updateAutomationPipeline)
        },
    )
