import { Injectable, Optional } from "@nestjs/common"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import { TOOL } from "@nivo-lite/blocks-core"
import { MODULE_DECLARATIONS, agentGuidanceOf } from "@nivo-lite/blocks-core/modules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectClock, type Clock } from "@modules/platform/clock"
import {
    CONVERSATION_ENTITY,
    LEAD_KIND,
    LEDGER_ENTITY,
    SENT_LINES_LOOKED_AT,
    STOP_ENTITY,
    alreadySentOf,
    leadStopsQueryOf,
    ledgerLinesOf,
    policyValuesOf,
    savedNamesOf,
    sentLinesOf,
    settingsEntityOf,
    settingsQueryOf,
    stepLedgerQueryOf,
    stepPlaceOf,
    stopCounts,
    stopToldOf,
    type PolicyValues,
    type SentLine,
    type StepPlace,
    type StopTold,
} from "./policies/turn-policy.policy"

/** The data kind of a line of a customer conversation. */
const MESSAGE_KIND = "message"

/** The cursor scope of the settings lookup (it never pages past its one row). */
const SETTINGS_SCOPE = cursorScopeOf("agent-graphs.turn-policy", {}, "id")

/** The cursor scope of the reads of what a customer was told (a step's ledger records, a customer's stops; one page each). */
const TOLD_SCOPE = cursorScopeOf("agent-graphs.turn-policy.told", {}, "id")

/** The effects whose calls are lines told to a customer. */
const CUSTOMER_LINE_EFFECTS: ReadonlyArray<string> = [TOOL.customerMessageSend]

@Injectable()
/**
 * What the turn of a step tells its agent beyond the step's own goal, so that the policy the module declares really reaches the model:
 * the guidance of the agent's policy in the run's language (the words are the module's, never the engine's), the whole tool set the
 * module declares for its agent (shown in every model call, the same from step to step, so a provider caches it), the values of that policy
 * as they stand for the workspace (the module's defaults, each replaced by the value the workspace saved in the module's settings under
 * the same name), and what the customer was already told (`alreadySent`): for a step that runs again after the founder's answer, the
 * lines it sent in its earlier attempts, read from the effect ledger (D.1: every conversation they went to) and from its conversation;
 * for any step, the lines the same customer was told for the stops of other runs (open, or resolved within a day), read from those
 * stops and from the ledger records of their steps. Facts only: the agent decides what is new. A module that declares no agent adds
 * nothing; a module with no settings record keeps its defaults.
 */
export class AgentGraphTurnPolicyService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        private readonly engine: EntityEngineService,
        @Optional() @InjectClock() private readonly clock?: Clock,
    ) {}

    /** The turn with what its agent is told: the policy of the module's agent, and what the step under `stepKey` already sent. */
    async toldOf(turn: NodeTurn, moduleKey: string, stepKey: string): Promise<NodeTurn> {
        const guidance = agentGuidanceOf(moduleKey, turn.locale)
        const agent = MODULE_DECLARATIONS.find((module) => module.key === moduleKey)?.agent
        const defaults = agent?.policy.limits ?? {}
        const agentTools = agent?.tools ?? []
        const policy = await this.valuesOf(turn.workspaceId, moduleKey, defaults)
        const sent = await this.sentOf(turn, stepKey)
        return {
            ...turn,
            ...(guidance === "" ? {} : { guidance }),
            ...(Object.keys(policy).length === 0 ? {} : { policy }),
            ...(agentTools.length === 0 ? {} : { agentTools }),
            ...(sent.length === 0 ? {} : { alreadySent: sent }),
        }
    }

    /**
     * The policy's values for the workspace: the defaults, with what the module's settings record holds under the same names, read in
     * the order the settings entity's unique key is indexed on (`settingsQueryOf`).
     */
    async valuesOf(workspaceId: string, moduleKey: string, defaults: PolicyValues): Promise<PolicyValues> {
        const entity = this.definitionOf(settingsEntityOf(moduleKey))
        if (entity === null) return defaults
        const query = settingsQueryOf(entity, savedNamesOf(defaults, Object.keys(entity.fields)))
        if (query === null || query.select.length === 0) return defaults
        const page = await this.engine.scoped(workspaceId, (tx) => this.engine.list(tx, query, SETTINGS_SCOPE))
        return policyValuesOf(defaults, page.rows[0]?.row.data ?? {})
    }

    /** The declaration of an entity, or null when the app holds no such entity. */
    private definitionOf(entity: string): EntityDefinition | null {
        try {
            return this.engine.definition(entity)
        } catch {
            return null
        }
    }

    /**
     * What the customer of the turn was already told, as `alreadySent` carries it: the step's own earlier lines when it runs again after
     * the founder's answer, and the lines of the customer's stops. None on a first try of a customer with no stop.
     */
    private async sentOf(turn: NodeTurn, stepKey: string): Promise<ReadonlyArray<SentLine>> {
        const place = stepPlaceOf(stepKey)
        const again = (turn.founderAnswers ?? []).length > 0
        const [ledger, conversation, stops] = await Promise.all([
            again && place !== null ? this.ledgerLinesOf(turn.workspaceId, place) : Promise.resolve([]),
            again ? this.conversationLinesOf(turn, stepKey) : Promise.resolve([]),
            this.stopLinesOf(turn, place),
        ])
        return alreadySentOf([...ledger, ...conversation, ...stops])
    }

    /**
     * The lines a run step told customers, from the effect ledger: every attempt, every conversation (a run with no conversation of
     * its own, a line sent to another conversation). None when the app holds no ledger.
     */
    private async ledgerLinesOf(workspaceId: string, place: StepPlace): Promise<ReadonlyArray<SentLine>> {
        if (this.definitionOf(LEDGER_ENTITY) === null) return []
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.engine.list(tx, stepLedgerQueryOf(place), TOLD_SCOPE),
        )
        return ledgerLinesOf(
            page.rows.map(({ row }) => ({ data: row.data, createdAt: row.createdAt })),
            CUSTOMER_LINE_EFFECTS,
        )
    }

    /**
     * The lines the step already sent in the run's conversation, read among the conversation's latest agent lines by the step's own
     * key (lines written before the ledger kept arguments are found here). None without a conversation, or when the app serves no
     * conversation lines.
     */
    private async conversationLinesOf(turn: NodeTurn, stepKey: string): Promise<ReadonlyArray<SentLine>> {
        if (turn.conversationId === null) return []
        const port = this.nodes.optionalPortOf(MESSAGE_KIND)
        if (port === undefined) return []
        const rows = await port.read(
            turn,
            {
                where: { conversationId: turn.conversationId, role: "agent" },
                fields: ["text", "sentAt", "channelRef"],
                limit: SENT_LINES_LOOKED_AT,
            },
            "workspace",
        )
        return sentLinesOf(rows, stepKey)
    }

    /**
     * The lines the customer of the turn was told for their stops (open, or resolved within a day), on any run: the lines each stop
     * holds, and the customer lines its step's ledger records hold. The ledger records of the turn's own step are left to `sentOf`'s
     * first read (only after the founder's answer): a crash re-drive of this very visit must be told what its first try was told.
     * None for a turn with no known customer, or when the app holds no stops.
     */
    private async stopLinesOf(turn: NodeTurn, own: StepPlace | null): Promise<ReadonlyArray<SentLine>> {
        if (this.definitionOf(STOP_ENTITY) === null) return []
        const leadId = await this.leadOf(turn)
        if (leadId === null) return []
        const now = this.clock?.now() ?? null
        const pages = await Promise.all(
            (["open", "resolved"] as const).map((state) =>
                this.engine.scoped(turn.workspaceId, (tx) =>
                    this.engine.list(tx, leadStopsQueryOf(leadId, state), TOLD_SCOPE),
                ),
            ),
        )
        const stops = pages
            .flatMap((page) => page.rows.map(({ row }) => stopToldOf(row.data)))
            .filter((stop): stop is StopTold => stop !== null && stopCounts(stop, now))
        const recorded = await Promise.all(
            stops.map((stop) =>
                own !== null && stop.runId === own.runId && stop.stepKey === own.stepKey
                    ? Promise.resolve([])
                    : this.ledgerLinesOf(turn.workspaceId, stop),
            ),
        )
        return [...stops.flatMap((stop) => stop.lines), ...recorded.flat()]
    }

    /** The customer of the turn: its subject when that is a customer, else the customer its conversation names; null when neither. */
    private async leadOf(turn: NodeTurn): Promise<string | null> {
        if (turn.subject?.kind === LEAD_KIND) return turn.subject.id
        const { conversationId } = turn
        if (conversationId === null || this.definitionOf(CONVERSATION_ENTITY) === null) return null
        const row = await this.engine.scoped(turn.workspaceId, (tx) =>
            this.engine.get(tx, CONVERSATION_ENTITY, conversationId),
        )
        const leadId = row?.data.leadId
        return typeof leadId === "string" && leadId !== "" ? leadId : null
    }
}
