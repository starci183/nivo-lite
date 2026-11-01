import { Injectable } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import type { AgentRunItemVerdicts } from "./agent-runs-engine.contracts"
import type { StepDecision } from "./agent-runs.contracts"

/** Who a recovered decision names: the closed item does not keep the person who decided. */
const RECOVERED = "recovered"

@Injectable()
/** Reads the verdicts the work items already hold: done is approved, rejected is refused, anything else is still open. */
export class AgentRunItemVerdictsService implements AgentRunItemVerdicts {
    constructor(private readonly items: WorkItemsService) {}

    /** The verdict of each item that closed by a decision. */
    async verdictsOf(ids: ReadonlyArray<string>): Promise<ReadonlyMap<string, StepDecision>> {
        if (ids.length === 0) return new Map()
        const items = await this.items.findMany(ids, ids.length)
        return new Map(
            items.flatMap((item) =>
                item.status === "done" || item.status === "rejected"
                    ? [[item.id, { approved: item.status === "done", by: RECOVERED }] as const]
                    : [],
            ),
        )
    }
}
