import { Injectable } from "@nestjs/common"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import { MODULE_DECLARATIONS, agentGuidanceOf } from "@nivo-lite/blocks-core/modules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import {
    SENT_LINES_LOOKED_AT,
    policyValuesOf,
    savedNamesOf,
    sentLinesOf,
    settingsEntityOf,
    settingsQueryOf,
    type PolicyValues,
    type SentLine,
} from "./policies/turn-policy.policy"

/** The data kind of a line of a customer conversation. */
const MESSAGE_KIND = "message"

/** The cursor scope of the settings lookup (it never pages past its one row). */
const SETTINGS_SCOPE = cursorScopeOf("agent-graphs.turn-policy", {}, "id")

@Injectable()
/**
 * What the turn of a step tells its agent beyond the step's own goal, so that the policy the module declares really reaches the model:
 * the guidance of the agent's policy in the run's language (the words are the module's, never the engine's), the whole tool set the
 * module declares for its agent (shown in every model call, the same from step to step, so a provider caches it), the values of that policy
 * as they stand for the workspace (the module's defaults, each replaced by the value the workspace saved in the module's settings under
 * the same name), and, for a step that runs again after the founder's answer, the lines it already sent the customer. A module that
 * declares no agent adds nothing; a module with no settings record keeps its defaults.
 */
export class AgentGraphTurnPolicyService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        private readonly engine: EntityEngineService,
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
     * The lines the step already sent in the run's conversation, for a step that runs again (the turn carries the founder's answers):
     * read among the conversation's latest agent lines by the step's own key. None on a first try, without a conversation, or when the
     * app serves no conversation lines.
     */
    private async sentOf(turn: NodeTurn, stepKey: string): Promise<ReadonlyArray<SentLine>> {
        if (turn.conversationId === null || (turn.founderAnswers ?? []).length === 0) return []
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
}
