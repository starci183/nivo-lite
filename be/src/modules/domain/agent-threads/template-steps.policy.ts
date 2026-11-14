import { WAIT_ROUTE_MEMBER } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED, TEMPLATE_IF_STEP, TEMPLATE_UNTIL_STEP, TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"
import type { CompiledStep, CompiledTemplate } from "./template-compiler.policy"
import { TEMPLATE_HAND_BACK_STEP } from "./thread-hand-back.policy"

/**
 * The step ids a version may run besides the `defineNode` nodes while both forms run in one install: every template node
 * (`defineTemplateNode`), the engine's own `if` of a @2 graph (`TEMPLATE_IF_STEP`) and its loop until a condition
 * (`TEMPLATE_UNTIL_STEP`, whose rounds the engine drives itself), its wait (`TEMPLATE_WAIT_STEP`, parked and resumed by the engine)
 * and the hand-back of what a wait took (`TEMPLATE_HAND_BACK_STEP`).
 */
export const templateStepIds = (): ReadonlySet<string> =>
    new Set([
        TEMPLATE_IF_STEP,
        TEMPLATE_UNTIL_STEP,
        TEMPLATE_WAIT_STEP,
        TEMPLATE_HAND_BACK_STEP,
        ...INSTALLED.templateNodes().map((node) => node.id),
    ])

/**
 * The output member a template routing node routes by (`routes.by`), `trigger` for the engine's wait (it answers the key that came), or
 * null for a step that is neither.
 */
export const routeByOfStep = (stepId: string): string | null =>
    stepId === TEMPLATE_WAIT_STEP ? WAIT_ROUTE_MEMBER : (INSTALLED.templateNodeOf(stepId)?.routes?.by ?? null)

/** One compiled step, routing on its template node's own member instead of `branch` (an `if` keeps `branch`: the engine answers it). */
const routedStep = (step: CompiledStep, routeByOf: (stepId: string) => string | null): CompiledStep => {
    const by = step.exit.kind === "branch" ? routeByOf(step.step) : null
    return by === null || step.exit.kind !== "branch" ? step : { ...step, exit: { ...step.exit, field: by } }
}

/**
 * A compiled version whose template routing nodes route on `output[routeBy]` (contract C1: a routing node names the member that holds
 * the route; `@1` read `branch` always). Pure: every other step is kept as compiled.
 */
export const withTemplateRoutes = (
    compiled: CompiledTemplate,
    routeByOf: (stepId: string) => string | null = routeByOfStep,
): CompiledTemplate => ({ ...compiled, nodes: compiled.nodes.map((step) => routedStep(step, routeByOf)) })
