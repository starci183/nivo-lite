import { QueryHandler } from "@nestjs/cqrs"
import { ThreadWaitExpiryService, type ParkedWait } from "@modules/domain/agent-threads"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ContactsService } from "@modules/domain/contacts"
import { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { SandboxWaitingRunsQuery } from "./provider-sandbox.queries"
import type { SandboxWaitingRunView } from "./provider-sandbox.contracts"

/** The runs listed when the page does not say. */
export const WAITING_RUNS_DEFAULT = 20

/** The most runs one read lists. */
export const WAITING_RUNS_MAX = 50

/** A field of a run's context read as text; null when it is not a non-empty text. */
const textOf = (context: Readonly<Record<string, unknown>>, name: string): string | null => {
    const value = context[name]
    return typeof value === "string" && value !== "" ? value : null
}

@QueryHandler(SandboxWaitingRunsQuery)
/**
 * The runs parked at a wait, labelled for the Sandbox page: the gate first (sandbox on, owner or manager), then the engine's list
 * (newest first), the agents' names in ONE read, the people's names one read per distinct contact (at most the rows listed).
 */
export class SandboxWaitingRunsHandler extends ICQRSHandler<SandboxWaitingRunsQuery, ReadonlyArray<SandboxWaitingRunView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly accounts: ProviderSandboxAccountsService,
        private readonly expiry: ThreadWaitExpiryService,
        private readonly agents: AgentDirectoryService,
        private readonly contacts: ContactsService,
    ) {
        super(logger)
    }

    protected override async process(query: SandboxWaitingRunsQuery): Promise<ReadonlyArray<SandboxWaitingRunView>> {
        const { workspaceId } = query.params.request
        await this.accounts.assertManager({ principalId: query.params.principal.id, workspaceId })
        const limit = Math.max(1, Math.min(query.params.request.limit ?? WAITING_RUNS_DEFAULT, WAITING_RUNS_MAX))
        const parked = await this.expiry.parked(workspaceId, limit)
        const agentNames = await this.agentNamesOf(workspaceId, parked)
        const personNames = await this.personNamesOf(workspaceId, parked)
        return parked.map((run) => {
            const contactId = textOf(run.context, "contactId")
            const routeId = textOf(run.context, "routeId") ?? textOf(run.context, "conversationId")
            return {
                runId: run.runId,
                agentId: run.agentId,
                agentLabel: agentNames.get(run.agentId) ?? run.agentId,
                personLabel: (contactId === null ? null : (personNames.get(contactId) ?? contactId)) ?? routeId ?? "",
                routeId,
                waitsFor: [...new Set(run.waitsFor.map((one) => one.verb))],
                parkKey: run.parkKey,
                dueAt: run.dueAt,
            }
        })
    }

    /** The name of each distinct agent, by id, from one batch read. */
    private async agentNamesOf(workspaceId: string, parked: ReadonlyArray<ParkedWait>): Promise<Map<string, string>> {
        const cards = await this.agents.cardsOf(workspaceId, [...new Set(parked.map((run) => run.agentId))])
        return new Map(cards.map((card) => [card.id, card.name]))
    }

    /** The display name of each distinct contact the runs name, by id; a contact with no name or no longer there is left out. */
    private async personNamesOf(workspaceId: string, parked: ReadonlyArray<ParkedWait>): Promise<Map<string, string>> {
        const ids = [...new Set(parked.flatMap((run) => textOf(run.context, "contactId") ?? []))]
        const names = new Map<string, string>()
        await eachInOrder(ids, async (id) => {
            const name = (await this.contacts.get(workspaceId, id))?.displayName ?? null
            if (name !== null) names.set(id, name)
        })
        return names
    }
}
