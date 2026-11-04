import type { BlockDefinition } from "../block/block.types"
import type { SpecText } from "../schema/schema.types"
import { PlanError } from "./plan-error"
import type { SpecBindings } from "./spec"
import { blockIndex, specProblems } from "./spec"
import type {
    SpecActionBinding,
    SpecForbidden,
    SpecNode,
    SpecProblem,
    SpecReadBinding,
    SpecWhen,
    StoredSpec,
} from "./spec.types"

/** One node ready to draw: its block, props parsed by the block zod schema, bindings split by kind, and its children. */
export interface PlanNode {
    /** The id of the spec node, a stable address for tests and the composer. */
    readonly id: string
    /** The definition of the block the node names. */
    readonly block: BlockDefinition
    /** The props of the node as the block's schema parsed them, defaults filled. */
    readonly props: Readonly<Record<string, unknown>>
    /** The read bindings of the node by slot name. */
    readonly reads: Readonly<Record<string, SpecReadBinding>>
    /** The action bindings of the node by slot name. */
    readonly actions: Readonly<Record<string, SpecActionBinding>>
    /** The child nodes, in the order they are drawn. */
    readonly children: ReadonlyArray<PlanNode>
    /** What a viewer needs for the node to be drawn; null when it needs nothing. */
    readonly when: SpecWhen | null
    /** What the node does when a read of it is forbidden. */
    readonly forbidden: SpecForbidden
}

/** One view ready to draw. */
export interface PlanView {
    /** The id of the view, which a deep link names. */
    readonly id: string
    /** The words on the tab of the view. */
    readonly label: SpecText
    /** Whether the view draws no tab. */
    readonly hidden: boolean
    /** The route query key that selects the view when it is present; null when none does. */
    readonly openBy: string | null
    /** The block tree of the view. */
    readonly root: PlanNode
}

/** The plan of a valid spec, or the problems that refuse it. */
export type RenderPlan =
    | {
          /** The spec is valid. */
          readonly ok: true
          /** The blocks drawn above the tabs on every view. */
          readonly head: ReadonlyArray<PlanNode>
          /** The blocks drawn below the tabs on every view. */
          readonly foot: ReadonlyArray<PlanNode>
          /** The views, one tab each. */
          readonly views: ReadonlyArray<PlanView>
      }
    | { readonly ok: false; readonly problems: ReadonlyArray<SpecProblem> }

/** The bindings of a node split into reads and actions. */
interface SplitBindings {
    readonly reads: Record<string, SpecReadBinding>
    readonly actions: Record<string, SpecActionBinding>
}

/** Splits the bindings of a node into reads and actions. */
const splitBindings = (node: SpecNode): SplitBindings => {
    const reads: Record<string, SpecReadBinding> = {}
    const actions: Record<string, SpecActionBinding> = {}
    for (const [name, binding] of Object.entries(node.bind ?? {})) {
        if ("action" in binding) actions[name] = binding
        else reads[name] = binding
    }
    return { reads, actions }
}

/** One valid node as a plan node; the spec was validated, so its block exists and its props parse. */
export const planNode = (index: ReadonlyMap<string, BlockDefinition>, node: SpecNode): PlanNode => {
    const block = index.get(node.block)
    if (block === undefined) throw new PlanError("PLAN_SPEC_UNVALIDATED", node.block)
    return {
        id: node.id,
        block,
        props: block.props.parse(node.props ?? {}),
        ...splitBindings(node),
        children: (node.children ?? []).map((child) => planNode(index, child)),
        when: node.when ?? null,
        forbidden: node.forbidden ?? "notice",
    }
}

/** Validates a spec against the installed blocks and, when sound, resolves it into what the renderer draws. */
export const renderPlan = (
    spec: StoredSpec,
    blocks: ReadonlyArray<BlockDefinition>,
    bindings: SpecBindings = {},
): RenderPlan => {
    const problems = specProblems(spec, blocks, bindings)
    if (problems.length > 0) return { ok: false, problems }
    const index = blockIndex(blocks)
    return {
        ok: true,
        head: (spec.head ?? []).map((node) => planNode(index, node)),
        foot: (spec.foot ?? []).map((node) => planNode(index, node)),
        views: spec.views.map((view) => ({
            id: view.id,
            label: view.label,
            hidden: view.hidden === true,
            openBy: view.openBy ?? null,
            root: planNode(index, view.root),
        })),
    }
}

/**
 * The view a route opens: a hidden view whose `openBy` query is present, else the visible view the tab names, else the first
 * visible view. Undefined only when every view is hidden and none is opened.
 */
export const viewOf = (
    views: ReadonlyArray<PlanView>,
    tab: string | null,
    queryValue: (key: string) => string | null,
): PlanView | undefined =>
    views.find((view) => view.hidden && view.openBy !== null && queryValue(view.openBy) !== null) ??
    views.find((view) => !view.hidden && view.id === tab) ??
    views.find((view) => !view.hidden)
