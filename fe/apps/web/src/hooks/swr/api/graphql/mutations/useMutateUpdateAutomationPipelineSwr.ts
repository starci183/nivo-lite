import useSWRMutation from "swr/mutation"
import { mutateUpdateAutomationPipeline } from "@/modules/api/graphql/mutations/mutation-update-automation-pipeline"
import type { MutateUpdateAutomationPipelineRequest } from "@/modules/api/graphql/mutations/mutation-update-automation-pipeline"
import { automationCardViewOf } from "@/modules/automations"

/** What the UpdateAutomationPipeline mutation is triggered with. */
interface UpdateAutomationPipelineArg {
    readonly arg: MutateUpdateAutomationPipelineRequest
}

/** The SWR key of the update automation pipeline mutation. */
export const MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR_KEY = "MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR"

/** SWR mutation for {@link mutateUpdateAutomationPipeline}: `trigger({ templateKey, ...patch })` answers the card as it stands afterwards. */
export const useMutateUpdateAutomationPipelineSwr = () =>
    useSWRMutation(
        MUTATE_UPDATE_AUTOMATION_PIPELINE_SWR_KEY,
        async (_key: string, { arg }: UpdateAutomationPipelineArg) => {
            const result = await mutateUpdateAutomationPipeline({ request: arg })
            if (!result.data) throw new Error("updateAutomationPipeline answered no data")
            return automationCardViewOf(result.data.updateAutomationPipeline)
        },
    )
