import { Inject, Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConversationContactsService } from "@modules/domain/contacts"
import { ChannelDeliveriesService } from "@modules/domain/customer-routes"
import { NODE_EFFECT_STORE, type NodeEffectStore, type NodeTurn } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { withDefaultReads } from "./policies/agent-tools.policy"
import { RunStopRecordsService } from "@modules/domain/agent-threads/stops/run-stop-records.service"
import { AgentGraphRunQueueService } from "./agent-graph-run-queue.service"
import {
    STEP_RECORDS_LOOKED_AT,
    STOPS_LOOKED_AT,
    alreadySentOf,
    doneEffectsOf,
    founderDecisionsOf,
    ledgerLinesOf,
    stepPlaceOf,
    stopCounts,
    stopToldOf,
    type FounderDecision,
    type LedgerRow,
    type SentLine,
    type StepPlace,
    type StopTold,
} from "./policies/turn-policy.policy"

/** The effects whose calls are lines told to a customer. */
const CUSTOMER_LINE_EFFECTS: ReadonlyArray<string> = [TOOL.customerMessageSend]

@Injectable()
/**
 * What the turn of a step tells its agent beyond the step's own goal: the guidance of the agent's module in the run's language (the
 * words are the module's craft, never the engine's), the whole tool set the module declares for its agent (shown in every model call,
 * the same from step to step, so a provider caches it), and what the customer was already told (`alreadySent`): for a step that runs again after the founder's answer, the
 * lines it sent in its earlier attempts, read from the effect ledger of the run step (D.1: every conversation they went to; the engine reads no chatbot record);
 * for any step, the lines the same customer was told for the stops of other runs (open, or resolved within a day), read from those
 * stops and from the ledger records of their steps. Facts only: the agent decides what is new. A module that declares no agent adds
 * nothing.
 */
export class AgentGraphTurnPolicyService {
    constructor(
        @Optional() @InjectClock() private readonly clock?: Clock,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
        @Optional() private readonly contacts?: ConversationContactsService,
        @Optional() private readonly stops?: RunStopRecordsService,
        @Optional() @Inject(NODE_EFFECT_STORE) private readonly ledger?: NodeEffectStore,
        @Optional() private readonly deliveries?: ChannelDeliveriesService,
        @Optional() private readonly queue?: AgentGraphRunQueueService,
    ) {}

    /** The turn with what its agent is told: the module's guidance and tool set, and what the step under `stepKey` already sent. */
    async toldOf(turn: NodeTurn, moduleKey: string, stepKey: string): Promise<NodeTurn> {
        await this.requireOpen(turn.workspaceId, moduleKey)
        // The agent of the module as the plugin that declares it wrote it: the engine names no package (the installation is the array).
        const guidance = INSTALLED.guidanceOf(moduleKey, turn.locale)
        const agent = INSTALLED.agentOf(moduleKey)
        const agentTools = agent === null ? [] : withDefaultReads(agent.tools)
        const [{ sent, done, decided }, events, waiting] = await Promise.all([
            this.toldBefore(turn, stepKey),
            this.queueOf(turn, stepPlaceOf(stepKey)),
            this.queue?.waitingOf(turn, stepPlaceOf(stepKey)) ?? Promise.resolve(0),
        ])
        return {
            ...turn,
            ...(guidance === "" ? {} : { guidance }),
            ...(agentTools.length === 0 ? {} : { agentTools }),
            ...(sent.length === 0 ? {} : { alreadySent: sent }),
            ...(done.length === 0 ? {} : { alreadyDone: done }),
            ...(decided.length === 0 ? {} : { founderDecisions: decided }),
            ...(events.length === 0 ? {} : { queue: events }),
            ...(waiting === 0 ? {} : { waiting }),
        }
    }

    /**
     * The run's QUEUE as this step visit sees it (ROAD-API section 4): the events of the run's key that arrived while it was in flight
     * (busy in a step, or waiting at a stop) and that this visit took, oldest first, as a fixed snapshot kept once per visit (a re-run of
     * the visit reads the same). None outside a run, or in an app with no queue. The node reads it as `run.queue`.
     */
    private async queueOf(turn: NodeTurn, place: StepPlace | null): Promise<NonNullable<NodeTurn["queue"]>> {
        if (this.queue === undefined) return []
        // Once a person decided on a stop of the run (Retry included, not only answers in words), the run's next step visits take the
        // events held behind it while it stopped (rule Q-1; R18 kept generic).
        const decided =
            place !== null &&
            this.stops !== undefined &&
            (await this.stops.ofRun(turn.workspaceId, place.runId)).some((stop) => stop.answers.length > 0)
        return this.queue.snapshotOf(turn, place, decided)
    }

    /**
     * Stops the step of an agent whose module is closed to the workspace: a module of a private plugin runs only in the enterprise
     * workspaces the plugin names, so when the workspace's enterprise identifier is cleared or changed its installed private agents
     * stop here, before any model call, and the refusal is the step's trouble: it reaches the team through the engine's common
     * report path like every step that could not run. A module of a public plugin costs no read.
     */
    private async requireOpen(workspaceId: string, moduleKey: string): Promise<void> {
        if (INSTALLED.isOpenTo(moduleKey, null)) return
        if ((await this.enterprise?.opens(workspaceId, moduleKey)) === true) return
        throw new AgentGraphsError({ code: AgentGraphsErrorCode.ModuleClosed, params: { module: moduleKey } })
    }

    /**
     * What the step did and the customer was told before (`alreadyDone`, `alreadySent`). `alreadyDone` is read only after the founder's
     * answer, from THIS run step's own ledger records (D-W8-1). What the customer of the turn was already told, as `alreadySent` carries it: the step's own earlier lines when it runs again after
     * the founder's answer, and the lines of the customer's stops. None on a first try of a customer with no stop.
     */
    private async toldBefore(
        turn: NodeTurn,
        stepKey: string,
    ): Promise<{
        readonly sent: ReadonlyArray<SentLine>
        readonly done: ReadonlyArray<string>
        readonly decided: ReadonlyArray<FounderDecision>
    }> {
        const place = stepPlaceOf(stepKey)
        const again = (turn.founderAnswers ?? []).length > 0
        const [own, claimed, stops] = await Promise.all([
            again && place !== null ? this.ledgerRowsOf(turn.workspaceId, place) : Promise.resolve([]),
            again && place !== null ? this.deliveredLinesOf(turn.workspaceId, place) : Promise.resolve([]),
            this.stopLinesOf(turn, place),
        ])
        return {
            sent: alreadySentOf([...ledgerLinesOf(own, CUSTOMER_LINE_EFFECTS), ...claimed, ...stops.lines]),
            // D-W8-1: what THIS run + step already did before its stop, from its own ledger records only (never another run's).
            done: doneEffectsOf(own),
            // D-MX-1: what the founder answered on the customer's OTHER stops is the shop's decision for this customer.
            decided: founderDecisionsOf(stops.stops, place),
        }
    }

    /**
     * The lines a run step told customers, from the effect ledger: every attempt, every conversation (a run with no conversation of
     * its own, a line sent to another conversation). None when the app holds no ledger.
     */
    private async ledgerLinesOf(workspaceId: string, place: StepPlace): Promise<ReadonlyArray<SentLine>> {
        return ledgerLinesOf(await this.ledgerRowsOf(workspaceId, place), CUSTOMER_LINE_EFFECTS)
    }

    /**
     * The lines one run step told, from the engine's own delivery ledger (every send is claimed there once per send key before the
     * provider is asked): always read for a step that runs again, whatever its effect rows kept. A send counts as told when it was
     * delivered, and also when its outcome is unknown or still in flight (engine-core rule 9: it may have reached the customer, so the step
     * must not say it twice); a refused send reached nobody and does not count. The words are the row's own, however they were bounded.
     * A line the effect ledger also holds is one line (the wording is told once). None when the app keeps no delivery ledger.
     */
    private async deliveredLinesOf(workspaceId: string, place: StepPlace): Promise<ReadonlyArray<SentLine>> {
        if (this.deliveries === undefined) return []
        const rows = await this.deliveries.listByStep(workspaceId, place.runId, place.stepKey, STEP_RECORDS_LOOKED_AT)
        return rows.flatMap((row) =>
            row.state !== "refused" && row.text !== "" ? [{ text: row.text, at: row.deliveredAt ?? row.createdAt }] : [],
        )
    }

    /** The ledger records of one run step (every attempt, every conversation); none when the app holds no ledger. */
    private async ledgerRowsOf(workspaceId: string, place: StepPlace): Promise<ReadonlyArray<LedgerRow>> {
        const { ledger } = this
        if (ledger === undefined) return []
        const rows = await ledger.ofStep(workspaceId, place.runId, place.stepKey, STEP_RECORDS_LOOKED_AT)
        return rows.map((row) => ({
            data: { effectId: row.effectId, args: row.args, subjectEntity: row.subjectEntity, undoneAt: row.undoneAt },
            createdAt: row.createdAt,
        }))
    }

    /**
     * The lines the customer of the turn was told for their stops (open, or resolved within a day), on any run: the lines each stop
     * holds, and the customer lines its step's ledger records hold. The ledger records of the turn's own step are left to `sentOf`'s
     * first read (only after the founder's answer): a crash re-drive of this very visit must be told what its first try was told.
     * None for a turn with no known customer, or when the app holds no stops.
     */
    private async stopLinesOf(
        turn: NodeTurn,
        own: StepPlace | null,
    ): Promise<{ readonly lines: ReadonlyArray<SentLine>; readonly stops: ReadonlyArray<StopTold> }> {
        const none = { lines: [], stops: [] }
        const { stops: store } = this
        if (store === undefined) return none
        const contactId = await this.contactOf(turn)
        if (contactId === null) return none
        const now = this.clock?.now() ?? null
        const pages = await Promise.all(
            (["open", "resolved"] as const).map((state) => store.ofContacts(turn.workspaceId, [contactId], state, STOPS_LOOKED_AT)),
        )
        const stops = pages.flat().map((item) => stopToldOf(item)).filter((stop) => stopCounts(stop, now))
        const recorded = await Promise.all(
            stops.map((stop) =>
                own !== null && stop.runId === own.runId && stop.stepKey === own.stepKey
                    ? Promise.resolve([])
                    : this.ledgerLinesOf(turn.workspaceId, stop),
            ),
        )
        return { lines: [...stops.flatMap((stop) => stop.lines), ...recorded.flat()], stops }
    }

    /** The person of the turn: the contact the run names, else the contact of its conversation's channel identity; null when none. */
    private async contactOf(turn: NodeTurn): Promise<string | null> {
        if (turn.contactId !== undefined && turn.contactId !== null) return turn.contactId
        const { conversationId } = turn
        if (conversationId === null || this.contacts === undefined) return null
        return this.contacts.contactOf(turn.workspaceId, conversationId)
    }
}
