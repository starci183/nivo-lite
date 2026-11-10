import { Injectable } from "@nestjs/common"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import type { HeldStop } from "./lead-freezes.contracts"

const STOP = "agent.run-stop"

/** Binds the cursor of every list of this reader: none is paged past one bounded page. */
const LIST_SCOPE = "lead-freeze-stops"

/** The most stops of one lead, or of one run, read at once. */
const STOPS_PAGE = 50

/** The most open stops of a workspace read to find those of a conversation (no index pins the conversation of a stop). */
const OPEN_PAGE = 100

const OPEN = "open"

const SELECT: ReadonlyArray<string> = [
    "runId",
    "stepKey",
    "agentId",
    "workflowId",
    "leadId",
    "conversationId",
    "customerLines",
    "state",
    "stoppedAt",
]

/** The order of the `lead_state` and `run` indexes after their pinned fields. */
const BY_ID: OrderBy = [["id", "asc"]]

/** The order of the `state_stopped` index after the state: newest stop first. */
const NEWEST: OrderBy = [
    ["stoppedAt", "desc"],
    ["id", "desc"],
]

const eq = (field: string, value: string): FilterExpr => ({ op: "eq", field, value })

const textOf = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null)

/** The conversations a stop's `customerLines` (`{ lines: [{ conversationId, text, at }] }`) went to, once each, in the order told. */
const toldOf = (customerLines: unknown): ReadonlyArray<string> => {
    const lines: unknown =
        typeof customerLines === "object" && customerLines !== null ? Reflect.get(customerLines, "lines") : undefined
    if (!Array.isArray(lines)) return []
    const told = lines.flatMap((line: unknown) =>
        typeof line === "object" && line !== null ? (textOf(Reflect.get(line, "conversationId")) ?? []) : [],
    )
    return [...new Set(told)]
}

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
        toldConversationIds: toldOf(data.customerLines),
        stoppedAt: textOf(data.stoppedAt) ?? row.createdAt,
    }
}

/** The stops once each (a stop of the lead and of the conversation is read twice), in the order first read. */
const distinctOf = (stops: ReadonlyArray<HeldStop>): ReadonlyArray<HeldStop> =>
    stops.filter(
        (stop, at) => stops.findIndex((one) => one.runId === stop.runId && one.stepKey === stop.stepKey) === at,
    )

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
 * a customer and the open stops of one run. Reads only. Every read is served by a declared index of the entity: `lead_state` (lead, state), `run`
 * (run, then the state in code) and `state_stopped` (open stops, newest first, the conversation matched in code).
 */
export class LeadFreezeStopsService {
    constructor(private readonly engine: EntityEngineService) {}

    /** The open stops about a customer: of their lead, or of their conversation; none when the customer names neither. */
    async openOfCustomer(workspaceId: string, customer: StopCustomer): Promise<ReadonlyArray<HeldStop>> {
        if (customer.leadId === null && customer.conversationId === null) return []
        return this.engine.scoped(workspaceId, async (tx) => {
            const ofLead =
                customer.leadId === null
                    ? []
                    : await this.read(tx, { op: "and", of: [eq("leadId", customer.leadId), eq("state", OPEN)] }, BY_ID)
            const ofConversation =
                customer.conversationId === null
                    ? []
                    : (await this.read(tx, eq("state", OPEN), NEWEST, OPEN_PAGE)).filter(
                          (stop) =>
                              stop.conversationId === customer.conversationId ||
                              (customer.conversationId !== null && stop.toldConversationIds.includes(customer.conversationId)),
                      )
            return distinctOf([...ofLead, ...ofConversation])
        })
    }

    /** The open stops of a run, in the order they were written. */
    async openOfRun(workspaceId: string, runId: string): Promise<ReadonlyArray<HeldStop>> {
        return this.engine.scoped(workspaceId, (tx) => this.read(tx, eq("runId", runId), BY_ID))
    }

    private async read(
        tx: ScopedTx,
        where: FilterExpr,
        order: OrderBy,
        size: number = STOPS_PAGE,
    ): Promise<ReadonlyArray<HeldStop>> {
        const page = await this.engine.list(tx, { from: STOP, select: SELECT, where, order, page: { size } }, LIST_SCOPE)
        return page.rows.flatMap((listed) => heldStopOf(listed.row) ?? [])
    }
}
