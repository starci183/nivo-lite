import type { UpdatePipelineRequest } from "../../application/update-pipeline.contracts"
import type { UpdateAutomationPipelineInput } from "./dto/update-automation-pipeline.input"

/** Maps the GraphQL input to the command request; a null field means no change. */
export const toUpdatePipelineRequest = (
    workspaceId: string,
    input: UpdateAutomationPipelineInput,
): UpdatePipelineRequest => ({
    workspaceId,
    templateKey: input.templateKey,
    patch: {
        enabled: input.enabled,
        dismissed: input.dismissed,
        values: input.values,
        body: input.body,
        autoSend: input.autoSend,
        googleConnectionId: input.googleConnectionId,
    },
})
