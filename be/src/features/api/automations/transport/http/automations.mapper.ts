import type { BusinessEventInput, PipelinePatch } from "@modules/domain/automations"
import type { EmitEventRequest } from "./dto/emit-event.request"
import type { UpdatePipelineRequest } from "./dto/update-pipeline.request"

/** Maps the HTTP body of an event to the event the engine evaluates. */
export const toEmitEventRequest = (input: EmitEventRequest): BusinessEventInput => ({
    event: input.event,
    data: input.data,
    dedupe: input.dedupe,
})

/** Maps the HTTP body of a pipeline change to the patch of the domain. */
export const toPatchRequest = (input: UpdatePipelineRequest): PipelinePatch => ({
    enabled: input.enabled,
    dismissed: input.dismissed,
    values: input.values,
    body: input.body,
    autoSend: input.autoSend,
    googleConnectionId: input.googleConnectionId,
})
