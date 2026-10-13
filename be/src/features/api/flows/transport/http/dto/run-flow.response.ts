import type { FlowPayload } from "@modules/domain/flows"

/** What the flow engine answered. */
export class RunFlowResponse {
    /** The answer, as the engine builds it. */
    data!: FlowPayload
}
