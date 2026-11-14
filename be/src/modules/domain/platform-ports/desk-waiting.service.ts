import { Injectable, Optional } from "@nestjs/common"
import {
    RunStopRecordsService,
    ThreadApprovalsService,
    ThreadResumeRequestsService,
    type RunStop,
} from "@modules/domain/agent-threads"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { stopFactOf, waitingIdOf, waitingRowOf } from "./agent-desk.mapper"
import type { ApprovalDecideAnswer, ApprovalVerdictAsk, DeskAsker, WaitingOnPersonView } from "./agent-desk.contracts"
import { DeskRunsService } from "./desk-runs.service"

/** The most open stops of the workspace one read takes (one page of the stops' `state_stopped` index), newest first. */
export const OPEN_STOPS_READ = 50

@Injectable()
/**
 * What of an agent waits on a person, on the THREADS engine: its runs' open stops (an approval of a call, with its owner item; any
 * other stop, answered on its card in /chat), newest first, each with who asked for the run's work and what would change from the
 * facts the stop holds. A verdict on an approval goes through the thread approvals' one door (`ThreadApprovalsService.verdict`, the
 * door the /chat card's verdict reaches through the operating flow): an owner or manager seat decides, only the owner approves, and
 * `not_waiting` is that door's; the engine replays the approved call itself. Nothing here writes a stop by itself.
 */
export class DeskWaitingService {
    constructor(
        private readonly stops: RunStopRecordsService,
        private readonly runs: DeskRunsService,
        private readonly seats: WorkspaceMemberSeatsService,
        @Optional() private readonly approvals?: ThreadApprovalsService,
        @Optional() private readonly threads?: ThreadResumeRequestsService,
    ) {}

    /** The agent's runs stopped on a person, newest first. */
    async waiting(asker: DeskAsker, agentId: string): Promise<WaitingOnPersonView> {
        const open = await this.openOf(asker.workspaceId, agentId)
        const runs = await this.runs.runsOf(
            asker.workspaceId,
            agentId,
            open.map((stop) => stop.runId),
        )
        const askedBy = new Map(runs.map((run) => [run.id, run.askedBy]))
        const rows = open.map((stop) => waitingRowOf(stop, askedBy.get(stop.runId) ?? null))
        return { count: rows.length, rows }
    }

    /**
     * A verdict on an open approval of the agent, as the seat that asks: refused `not_waiting_here` when no open approval of this agent
     * has that id, `no_seat` with no active seat, `not_allowed` for a seat that is no owner or manager; else the approvals' door
     * decides it as that seat, and a refusal of that door is answered with its own code.
     */
    async decide(asker: DeskAsker, agentId: string, ask: ApprovalVerdictAsk): Promise<ApprovalDecideAnswer> {
        if (asker.memberId === null) return { kind: "refused", code: "no_seat" }
        const open = await this.openOf(asker.workspaceId, agentId)
        const waiting = open.find(
            (stop) =>
                stop.kind === "approval" && stopFactOf(stop, "workItemId") !== null && waitingIdOf(stop) === ask.id,
        )
        if (waiting === undefined) return { kind: "refused", code: "not_waiting_here" }
        const seat = await this.seats.seatById(asker.workspaceId, asker.memberId)
        if (seat?.status !== "active") return { kind: "refused", code: "no_seat" }
        if (seat.role !== "owner" && seat.role !== "manager") return { kind: "refused", code: "not_allowed" }
        if (this.approvals === undefined || this.threads === undefined) return { kind: "refused", code: "not_waiting_here" }
        const outcome = await this.approvals.verdict(
            {
                workspaceId: asker.workspaceId,
                workItemId: ask.id,
                verdict: ask.verdict === "approve" ? "approved" : "refused",
                by: asker.memberId,
                owner: seat.role === "owner",
                locale: asker.locale,
            },
            this.threads,
        )
        return outcome.kind === "decided" ? { kind: "decided", status: outcome.status } : { kind: "refused", code: outcome.code }
    }

    /** The agent's open stops among the newest open stops of the workspace. */
    private async openOf(workspaceId: string, agentId: string): Promise<ReadonlyArray<RunStop>> {
        const open = await this.stops.newest(workspaceId, "open", OPEN_STOPS_READ)
        return open.filter((stop) => stop.agentId === agentId)
    }
}
