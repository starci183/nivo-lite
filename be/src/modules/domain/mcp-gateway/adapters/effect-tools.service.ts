import { Injectable, Optional } from "@nestjs/common"
import type { EffectCall, EffectDefinition, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeEffectsService, GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { isRecord } from "@modules/platform/primitives"
import { McpGatewayError, McpGatewayErrorCode } from "../errors/mcp-gateway.error"
import { InjectConversationLeadsGate } from "../mcp-gateway.decorators"
import type {
    ConversationLeadsGate,
    GatewayJson,
    GatewayRun,
    NativeAdapter,
    NativeCaller,
    NativeConnectorManifest,
} from "../mcp-gateway.contracts"
import { pinRefusalOf } from "./effect-pin.policy"
import { answerOf, effectManifestsOf, refusalOf, refusalOfThrow } from "./effect-tools.policy"

/** Why a call reaches no effect: it runs in no graph step (the external surface, a bridge), or no module performs the effect. */
const NO_RUN = "no_run"
const NOT_SERVED = "not_served"

/** The turn an executor acts in, rebuilt from the step the run token signed. */
const turnOf = (workspaceId: string, caller: NativeCaller, run: GatewayRun): NodeTurn => ({
    turnId: run.turnId,
    workspaceId,
    agentId: caller.agentId,
    subject: null,
    conversationId: caller.conversationId,
    locale: run.locale,
    origin: run.origin,
    memberId: run.memberId,
    handedOffBy: run.handedOffBy,
})

@Injectable()
/**
 * NIVO's own business actions on the NIVO MCP gateway: every installed effect is a native tool whose full name is its id, served by the
 * very executor `context.effect` runs (nothing is written twice). A call runs only in a graph step (the run token signs it), stays inside
 * its run's conversation or lead, and acts once per step key through the effect ledger: a success is kept and answered again, a refusal
 * or a throw is not, so the call asked again really runs again. A typed guard an executor throws is answered as a refusal fact with its
 * code, the way the agent read it through `context.effect`. An app without the graph host (the mcp app, the cli) has no effect tools.
 */
export class EffectToolsService {
    constructor(
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() private readonly ledger?: GraphNodeEffectsService,
        @Optional() @InjectConversationLeadsGate() private readonly leads?: ConversationLeadsGate,
    ) {}

    /** One adapter per domain of the installed effects; none when the app runs no graph host. */
    adapters(): ReadonlyArray<NativeAdapter> {
        const { registry } = this
        if (registry === undefined || this.ledger === undefined) return []
        const effects = registry.installed().effects
        return effectManifestsOf(effects.values()).map((manifest) => this.adapterOf(manifest, effects))
    }

    private adapterOf(
        manifest: NativeConnectorManifest,
        effects: ReadonlyMap<string, EffectDefinition>,
    ): NativeAdapter {
        return {
            manifest,
            invoke: async (workspaceId, tool, args, caller) => {
                const effect = effects.get(`${manifest.key}.${tool}`)
                if (effect === undefined) throw new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool, params: { tool } })
                return answerOf(await this.run(workspaceId, effect, args, caller))
            },
        }
    }

    /** Runs one effect for the step of the caller: the refusal of a call outside a step or its run, else the executor once per step key. */
    private async run(
        workspaceId: string,
        effect: EffectDefinition,
        args: GatewayJson,
        caller: NativeCaller,
    ): Promise<SubjectRef> {
        const { run, opKey } = caller
        if (run === undefined || opKey === undefined || this.registry === undefined || this.ledger === undefined)
            return refusalOf(NO_RUN)
        const parsed = effect.payload.safeParse(args)
        if (!parsed.success || !isRecord(parsed.data)) {
            throw new McpGatewayError({ code: McpGatewayErrorCode.InvalidArguments, params: { tool: effect.id } })
        }
        const payload: Readonly<Record<string, unknown>> = parsed.data
        const pinned = await pinRefusalOf(this.leads ?? null, workspaceId, caller, payload)
        if (pinned !== null) return refusalOf(pinned)
        const executor = this.registry.optionalExecutorOf(effect.id)
        if (executor === undefined) return refusalOf(NOT_SERVED)
        const turn = turnOf(workspaceId, caller, run)
        const call: EffectCall = { key: opKey, dedupeKey: null }
        return this.ledger.once(workspaceId, effect.id, call, async () => {
            try {
                return await executor.execute(turn, payload, call)
            } catch (cause) {
                const refusal = refusalOfThrow(cause)
                if (refusal === null) throw cause
                return refusal
            }
        })
    }
}
