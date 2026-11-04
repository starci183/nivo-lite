import { SdkDefinitionError } from "../block/definition-error"
import type { BlockDefinition } from "../block/block.types"
import type { SpecText } from "../schema/schema.types"
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
    /** The spec node id. */
    readonly id: string
    /** The block definition that draws the node. */
    readonly block: BlockDefinition
    /** The node props, parsed by the block zod schema. */
    readonly props: Readonly<Record<string, unknown>>
    /** The read bindings by slot key. */
    readonly reads: Readonly<Record<string, SpecReadBinding>>
    /** The action bindings by slot key. */
    readonly actions: Readonly<Record<string, SpecActionBinding>>
    /** The child nodes, in drawing order. */
    readonly children: ReadonlyArray<PlanNode>
    /** The condition under which the node is shown, or null when always. */
    readonly when: SpecWhen | null
    /** What the node does when the viewer lacks the permission. */
    readonly forbidden: SpecForbidden
}

/** One view ready to draw. */
export interface PlanView {
    /** The view id. */
    readonly id: string
    /** The words the view is named by. */
    readonly label: SpecText
    /** True when the view is not in the navigation and is opened only by another view. */
    readonly hidden: boolean
    /** The id of the action that opens the view, or null. */
    readonly openBy: string | null
    /** The root node of the view. */
    readonly root: PlanNode
}

/** The plan of a valid spec, or the problems that refuse it. */
export type RenderPlan =
    | {
          readonly ok: true
          readonly head: ReadonlyArray<PlanNode>
          readonly foot: ReadonlyArray<PlanNode>
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
    if (block === undefined) throw new SdkDefinitionError("PLAN_BLOCK_UNKNOWN", node.block)
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
