import { Injectable } from "@nestjs/common"
import type { StepJson, StepSpec } from "@modules/domain/agent-runs"
import { finalReplyOwed } from "./output-steps.policy"

@Injectable()
/** The seam to the output steps of the graph: whether the run owes a final reply, so the model's own text does not leave. */
export class CustomerFinalReplyService {
    /** The final reply step the run owes from the steps done before the door, or null. */
    owedOf(earlier: Readonly<Record<string, StepJson>>): StepSpec | null {
        return finalReplyOwed(earlier)
    }
}
