import { Injectable } from "@nestjs/common"
import { RunStopRecordsService, type RunStop } from "@modules/domain/agent-threads"
import { AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ContactsService } from "@modules/domain/contacts"
import { DEPTH_MAX, offsetOf, sizeOf, viewOf, type RunStopNames } from "./run-stops-page.policy"
import type { OptionalCount, OptionalText } from "./agent-pages.contracts"
import type { RunStopsPage } from "./run-stops-page.contracts"

@Injectable()
/**
 * The open stops of a workspace for a person who may decide them (an owner or a manager: the guard of the stop door that answers
 * them), newest first, one page at a time, each with what answering it needs (the choices its card offers, an approval's tool and
 * arguments) and the names of its agent, workflow and customer. Read from the stops' own records (`run_stops`), never from /chat.
 */
export class RunStopsPageService {
    constructor(
        private readonly access: AgentWorkAccessService,
        private readonly records: RunStopRecordsService,
        private readonly agents: AgentDirectoryService,
        private readonly runs: AgentWorkflowRunsService,
        private readonly contacts: ContactsService,
    ) {}

    /** One page of the open stops of the workspace: `limit` stops (20 when absent), from the position the `cursor` names. */
    async open(
        principalId: string,
        workspaceId: string,
        limit: OptionalCount,
        cursor: OptionalText,
    ): Promise<RunStopsPage> {
        await this.access.manager(principalId, workspaceId)
        const offset = offsetOf(cursor)
        const size = sizeOf(limit)
        const depth = Math.min(offset + size, DEPTH_MAX)
        const [newest, total] = await Promise.all([
            this.records.newest(workspaceId, "open", depth),
            this.records.openCount(workspaceId),
        ])
        const stops = newest.slice(offset, depth)
        const names = await this.namesOf(workspaceId, stops)
        const end = offset + stops.length
        return {
            stops: stops.map((stop) => viewOf(stop, names)),
            total,
            next: end < Math.min(total, DEPTH_MAX) && stops.length === size ? String(end) : null,
        }
    }

    /** The agent, workflow (by run) and customer names of a page's stops. */
    private async namesOf(workspaceId: string, stops: ReadonlyArray<RunStop>): Promise<RunStopNames> {
        if (stops.length === 0) return { agents: new Map(), workflows: new Map(), contacts: new Map() }
        const contactIds = [...new Set(stops.flatMap((stop) => (stop.contactId === null ? [] : [stop.contactId])))]
        const [cards, pins, people] = await Promise.all([
            this.agents.cardsOf(workspaceId, [...new Set(stops.map((stop) => stop.agentId))]),
            this.runs.pinsOf(workspaceId, stops.map((stop) => stop.runId)),
            Promise.all(contactIds.map(async (id) => [id, (await this.contacts.get(workspaceId, id))?.displayName ?? null] as const)),
        ])
        return {
            agents: new Map(cards.map((card) => [card.id, card.name])),
            workflows: new Map(pins.map((pin) => [pin.runId, pin.workflowName])),
            contacts: new Map(people.flatMap(([id, name]) => (name === null ? [] : [[id, name] as const]))),
        }
    }
}
