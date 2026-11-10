import { mock } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { StepSpec } from "@modules/domain/agent-runs"
import type { AgentHandlerEnding } from "@modules/domain/agent-work"
import type { FlowWake } from "@modules/domain/agent-graphs"
import type { NodeToolDoor } from "@modules/domain/graph-nodes"
import { agentTurnViewOf } from "./agent-work.builder"
import { runViewOf } from "./agent-runs.builder"
import { NO_FLOW, driveQueue, flowServicesOf } from "./flow-f-world.builder"
import type { FlowDrive, FlowModelScript, FlowWorld } from "./flow-f-world.builder"
import { leadMemoryWorldOf } from "./lead-memory-world.builder"
import type { LeadMemoryWorld } from "./lead-memory-world.builder"
import { workflowWorldOf } from "./workflow-world.builder"
import type { ModuleName, WorkflowWorld } from "./workflow-world.builder"

/** How a wake was routed and run: where the engine sent it, the workflow it pinned, and the run it drove. */
export interface RoutedDrive extends FlowDrive {
    /** How the start of the run ended: `done`, or `skipped` when no workflow of the agent takes the wake. */
    readonly ending: AgentHandlerEnding
    /** The key of the workflow the run was pinned to, or null when none took the wake. */
    readonly workflow: string | null
    /** The trigger of the first step the engine wrote (`trigger.*` as the first node reads it), or null when none was written. */
    readonly trigger: Readonly<Record<string, unknown>> | null
    /** The memory namespace the run writes its outcomes under, or null. */
    readonly namespace: string | null
}

/** The agent of a module in the routed worlds. */
export const agentOf = (module: ModuleName): string => `${module}-agent`

/** The workflows of one agent per module (chatbot, sales, accounting), seeded from the templates behind the real routing. */
export const routedWorkflowsOf = (): WorkflowWorld =>
    workflowWorldOf({ [agentOf("chatbot")]: "chatbot", [agentOf("sales")]: "sales", [agentOf("accounting")]: "accounting" })


/**
 * Hands a wake to the REAL start of the run of an agent whose workflows were seeded from the templates: it routes the wake to one of them
 * (by the pin of a hand-off, else by a trigger's source, channel and conditions), opens the run, pins it and writes its first step; the
 * run is then driven step after step as the engine does, over the lead memory of the customer (an empty one unless `extra.memory` is
 * given). A wake no workflow takes starts nothing (the agent has no graph of its own that answers then).
 */
export const driveRouted = async (
    world: FlowWorld,
    workflows: WorkflowWorld,
    module: ModuleName,
    model: FlowModelScript,
    wake: FlowWake,
    extra: { readonly door?: NodeToolDoor; readonly memory?: LeadMemoryWorld } = {},
): Promise<RoutedDrive> => {
    const appended: Array<StepSpec> = []
    const runs = mock<AgentRunsService>({
        open: () => Promise.resolve(runViewOf({ id: "run-1", agentId: agentOf(module) })),
        append: (_workspace: string, _tx: unknown, _run: string, specs: ReadonlyArray<StepSpec>) => {
            appended.push(...specs)
            return Promise.resolve()
        },
    })
    const built = await flowServicesOf(world, NO_FLOW, model, extra.door, {
        runs,
        workflows,
        memory: extra.memory ?? leadMemoryWorldOf({}),
    })
    const turn = agentTurnViewOf({
        agentId: agentOf(module),
        source: wake.source,
        actorMemberId: wake.actorMemberId,
        context: structuredClone(wake.context),
    })
    const ending = await built.flows.run(turn)
    const first = appended.at(0)
    const driven = await driveQueue(built, appended)
    const input: Readonly<Record<string, unknown>> = first?.input ?? {}
    const trigger = input.trigger
    const namespace = input.namespace
    return {
        ...driven,
        ending,
        workflow: workflows.pins.get("run-1")?.workflowId.split(":").at(-1) ?? null,
        trigger: typeof trigger === "object" && trigger !== null ? Object.fromEntries(Object.entries(trigger)) : null,
        namespace: typeof namespace === "string" ? namespace : null,
    }
}
