import { Injectable } from "@nestjs/common"
import type { StepJson, StepSpec } from "@modules/domain/agent-runs"

@Injectable()
/**
 * The seam to the output steps of the graph: whether the run owes a final reply, so the model's own text does not leave. The output
 * steps land with the graph output; until they do no run owes one and the door answers as it always did.
 */
export class CustomerFinalReplyService {
    /** The final reply step the run owes from the steps done before the door, or null. */
    owedOf(_earlier: Readonly<Record<string, StepJson>>): StepSpec | null {
        return null
    }
}
