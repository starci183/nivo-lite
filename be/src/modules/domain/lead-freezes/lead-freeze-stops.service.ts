import { Injectable } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { HeldStop } from "./lead-freezes.contracts"

const STOP = "agent.run-stop"

/** Binds the cursor of every list of this reader: none is paged past one bounded page. */
const LIST_SCOPE = "lead-freeze-stops"

/** The most open stops of one customer, or of one run, read at once. */
const STOPS_PAGE = 50

const OPEN = "open"

const SELECT: ReadonlyArray<string> = [
    "runId",
    "stepKey",
    "agentId",
    "workflowId",
    "leadId",
    "conversationId",
    "state",
    "stoppedAt",
]

const BY_ID: OrderBy = [["id", "asc"]]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The open stop a row holds, or null for a row that is not open or names no run, step or agent (it holds nobody). */
const heldStopOf = (row: RecordRow): HeldStop | null => {
    const { data } = row
    const runId = textOf(data.runId)
    const stepKey = textOf(data.stepKey)
    const agentId = textOf(data.agentId)
    if (data.state !== OPEN || runId === null || stepKey === null || agentId === null) return null
    return {
        runId,
        stepKey,
        agentId,
        workflowId: textOf(data.workflowId),
        leadId: textOf(data.leadId),
        conversationId: textOf(data.conversationId),
        stoppedAt: textOf(data.stoppedAt) ?? row.createdAt,
    }
}

/** Who a customer is, as the reader looks them up: the lead and the conversation, either may be missing. */
export interface StopCustomer {
    /** The lead, when known. */
    readonly leadId: string | null
    /** The conversation, when known. */
    readonly conversationId: string | null
}

@Injectable()
/**
 * What a freeze reads of the stops of thread runs (`agent.run-stop`, written by the stops of the agent threads only): the open stops of
 * a customer (by the lead's index, or the conversation) and the open stops of one run. Reads only; a stop is never written here.
 */
export class LeadFreezeStopsService {
    constructor(private readonly engine: EntityEngineService) {}

    /** The open stops about a customer: of their lead, or of their conversation; none when the customer names neither. */
    openOfCustomer(workspaceId: string, customer: StopCustomer): Promise<ReadonlyArray<HeldStop>> {
        const named: ReadonlyArray<FilterExpr> = [
            ...(customer.leadId === null ? [] : [eq("leadId", customer.leadId)]),
            ...(customer.conversationId === null ? [] : [eq("conversationId", customer.conversationId)]),
        ]
        const [only] = named
        if (only === undefined) return Promise.resolve([])
        const who: FilterExpr = named.length === 1 ? only : { op: "or", of: named }
        return this.engine.scoped(workspaceId, (tx) => this.open(tx, { op: "and", of: [eq("state", OPEN), who] }))
    }

    /** The open stops of a run, in the order they were written. */
    openOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<HeldStop>> {
        return this.engine.scoped(workspaceId, (tx) =>
            this.open(tx, { op: "and", of: [eq("runId", runId), eq("state", OPEN)] }),
        )
    }

    private async open(tx: ScopedTx, where: FilterExpr): Promise<ReadonlyArray<HeldStop>> {
        const page = await this.engine.list(
            tx,
            { from: STOP, select: SELECT, where, order: BY_ID, page: { size: STOPS_PAGE } },
            LIST_SCOPE,
        )
        return page.rows.flatMap((listed) => heldStopOf(listed.row) ?? [])
    }
}
