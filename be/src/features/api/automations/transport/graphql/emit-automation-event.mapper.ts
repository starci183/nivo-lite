import type { EmitEventRequest } from "../../application/emit-event.contracts"
import type { EmitAutomationEventInput } from "./dto/emit-automation-event.input"

/** Maps the GraphQL input to the command request. */
export const toEmitEventRequest = (workspaceId: string, input: EmitAutomationEventInput): EmitEventRequest => ({
    workspaceId,
    event: { event: input.event, data: input.data, dedupe: input.dedupe },
})
