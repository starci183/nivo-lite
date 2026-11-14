import { Injectable, Optional } from "@nestjs/common"
import type { EffectCall, EffectDefinition, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { GraphNodeEffectsService, GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import type { Locale } from "@modules/platform/i18n"
import { isRecord } from "@modules/platform/primitives"
import { ToolsError, ToolsErrorCode } from "../errors/tools.error"
import { InjectConversationLeadsGate } from "../tools.decorators"
import type {
    ConversationLeadsGate,
    ToolJson,
    ToolRun,
    NativeToolFamily,
    NativeCaller,
    ToolManifest,
} from "../tools.contracts"
import { toolNameOf } from "../tool-name.policy"
import { pinRefusalOf } from "./effect-pin.policy"
import { answerOf, effectManifestsOf, refusalOf, refusalOfThrow } from "./effect-tools.policy"

/** Why a call reaches no effect: it runs in no graph step (the external surface, a bridge), or no module performs the effect. */
const NO_RUN = "no_run"
const NOT_SERVED = "not_served"

/** The language of a turn that is no run's: the workspace default of a request that states none. */
const JOB_LOCALE: Locale = "vi"

/** The road of a module's declared job (the engine's own caller), named in the audit by `RightOrigin`. */
const JOB_ROAD = "engine_job"

/** The turn an executor acts in, rebuilt from the step the run token signed. */
const turnOf = (workspaceId: string, caller: NativeCaller, run: ToolRun): NodeTurn => ({
    turnId: run.turnId,
    workspaceId,
    agentId: caller.agentId,
    subject: null,
    conversationId: caller.conversationId,
    locale: run.locale,
    origin: run.origin,
    memberId: run.memberId,
    handedOffBy: run.handedOffBy,
    // The gateway's own fact about the call (the approving member of an approved replay), never anything the arguments say.
    ...(caller.approvedBy === undefined ? {} : { approvedBy: caller.approvedBy }),
})

/**
 * The turn of a call a module's declared job made (the engine's own caller, no run, no workflow step): its job run is the turn, it serves
 * no customer by itself and carries no step, so the rights judge reads it as the engine's own road. Null for any other caller.
 */
const jobTurnOf = (workspaceId: string, caller: NativeCaller): NodeTurn | null => {
    if (caller.origin !== JOB_ROAD || caller.turnId === undefined) return null
    return {
        turnId: caller.turnId,
        workspaceId,
        agentId: caller.agentId,
        subject: null,
        conversationId: caller.conversationId,
        locale: JOB_LOCALE,
        ...(caller.byMember === undefined ? {} : { memberId: caller.byMember }),
    }
}

@Injectable()
/**
 * NIVO's own business actions on the engine tools registry: every installed effect is a native tool whose full name is its id, served by the
 * very executor `context.effect` runs (nothing is written twice). A call runs only in a graph step (the run token signs it) or in a module's
 * declared job (the door signs it as the `engine_job` road, with the job run as its turn); it stays inside its run's conversation or lead,
 * and acts once per step key (or the job's own business key) through the effect ledger: a success is kept and answered again, a refusal
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
    adapters(): ReadonlyArray<NativeToolFamily> {
        const { registry } = this
        if (registry === undefined || this.ledger === undefined) return []
        const effects = registry.installed().effects
        return effectManifestsOf(effects.values()).map((manifest) => this.adapterOf(manifest, effects))
    }

    private adapterOf(
        manifest: ToolManifest,
        effects: ReadonlyMap<string, EffectDefinition>,
    ): NativeToolFamily {
        return {
            manifest,
            invoke: async (workspaceId, tool, args, caller) => {
                const effect = effects.get(toolNameOf(manifest, tool))
                if (effect === undefined) throw new ToolsError({ code: ToolsErrorCode.UnknownTool, params: { tool } })
                return answerOf(await this.run(workspaceId, effect, args, caller))
            },
        }
    }

    /** Runs one effect for the step of the caller: the refusal of a call outside a step or its run, else the executor once per step key. */
    private async run(
        workspaceId: string,
        effect: EffectDefinition,
        args: ToolJson,
        caller: NativeCaller,
    ): Promise<SubjectRef> {
        const { run, opKey } = caller
        if (opKey === undefined || this.registry === undefined || this.ledger === undefined) return refusalOf(NO_RUN)
        const turn = run === undefined ? jobTurnOf(workspaceId, caller) : turnOf(workspaceId, caller, run)
        if (turn === null) return refusalOf(NO_RUN)
        const parsed = effect.payload.safeParse(args)
        if (!parsed.success || !isRecord(parsed.data)) {
            throw new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool: effect.id } })
        }
        const payload: Readonly<Record<string, unknown>> = parsed.data
        const pinned = await pinRefusalOf(this.leads ?? null, workspaceId, caller, payload)
        if (pinned !== null) return refusalOf(pinned)
        const executor = this.registry.optionalExecutorOf(effect.id)
        if (executor === undefined) return refusalOf(NOT_SERVED)
        const call: EffectCall = { key: opKey, dedupeKey: caller.onceBy ?? null }
        // The ledger keeps the call's arguments beside its subject (D.1), so a step's earlier sends are read back from it.
        return this.ledger.once(
            workspaceId,
            effect.id,
            call,
            async () => {
                try {
                    return await executor.execute(turn, payload, call)
                } catch (cause) {
                    // A job has no agent reading a refusal fact: what an executor throws is a failure of the call, which the job's queue tries again.
                    const refusal = run === undefined ? null : refusalOfThrow(cause)
                    if (refusal === null) throw cause
                    return refusal
                }
            },
            { args: payload },
        )
    }
}
