import {
    BellIcon,
    BoltIcon,
    BookOpenIcon,
    BuildingLibraryIcon,
    ChartBarIcon,
    ChatBubbleLeftRightIcon,
    CheckBadgeIcon,
    ClockIcon,
    ExclamationTriangleIcon,
    FlagIcon,
    GiftIcon,
    HandRaisedIcon,
    HashtagIcon,
    HeartIcon,
    MagnifyingGlassIcon,
    PaperAirplaneIcon,
    PencilSquareIcon,
    PhotoIcon,
    QrCodeIcon,
    QuestionMarkCircleIcon,
    ReceiptPercentIcon,
    ScaleIcon,
    ShareIcon,
    ShoppingBagIcon,
    SparklesIcon,
    TableCellsIcon,
    TruckIcon,
    UserIcon,
} from "@heroicons/react/24/outline"
import type {
    FlowGraphEdge,
    FlowGraphLegendItem,
    FlowGraphNode,
    FlowGraphRunStatus,
    FlowGraphStepKind,
    IconSource,
} from "@starci/grammar/common"
import { messageNamed } from "../../messages/catalog"
import type { NodeIcon } from "../../nodes/node-ui"
import type { NodeLocale } from "../../nodes/node-schema.types"
import type { GraphEdgeView, GraphNodeKind, GraphNodeView, GraphView, LoopView } from "../../rows/graph-view"

/** The glyph in the icon tile of each step icon: the Heroicons glyph the name stands for (`NODE_HEROICONS`), outline only. */
export const STEP_ICONS: Readonly<Record<NodeIcon, IconSource>> = {
    bolt: BoltIcon,
    bank: BuildingLibraryIcon,
    search: MagnifyingGlassIcon,
    "git-branch": ShareIcon,
    scale: ScaleIcon,
    "user-question": QuestionMarkCircleIcon,
    clock: ClockIcon,
    receipt: ReceiptPercentIcon,
    send: PaperAirplaneIcon,
    message: ChatBubbleLeftRightIcon,
    bell: BellIcon,
    book: BookOpenIcon,
    sparkles: SparklesIcon,
    user: UserIcon,
    pencil: PencilSquareIcon,
    qr: QrCodeIcon,
    table: TableCellsIcon,
    chart: ChartBarIcon,
    flag: FlagIcon,
    hash: HashtagIcon,
    bag: ShoppingBagIcon,
    photo: PhotoIcon,
    warning: ExclamationTriangleIcon,
    check: CheckBadgeIcon,
    heart: HeartIcon,
    truck: TruckIcon,
    gift: GiftIcon,
    hand: HandRaisedIcon,
}

/** The card kind of each graph node kind: the first drawing's kinds map on (trigger -> event, step -> action, output -> end). */
const STEP_KINDS: Readonly<Record<GraphNodeKind, FlowGraphStepKind>> = {
    trigger: "event",
    step: "action",
    condition: "condition",
    wait: "wait",
    output: "end",
    event: "event",
    action: "action",
    ask: "ask",
    end: "end",
}

/** One chip of a card, as the Grammar card takes it. */
type FlowGraphChip = NonNullable<FlowGraphNode["chips"]>[number]

/** The loop card of a node, as the Grammar card takes it. */
type FlowGraphContainer = NonNullable<FlowGraphNode["container"]>

/** The kinds the legend under a card map names, in its order, with the catalog key of each word. */
const LEGEND: ReadonlyArray<readonly [FlowGraphStepKind, string]> = [
    ["event", "graphKindEvent"],
    ["action", "graphKindAction"],
    ["condition", "graphKindCondition"],
    ["wait", "graphKindWait"],
]

/** The catalog key of the words of each run status. */
const STATUS_KEYS: Readonly<Record<FlowGraphRunStatus, string>> = {
    done: "graphStatusDone",
    running: "graphStatusRunning",
    failed: "graphStatusFailed",
    waiting: "graphStatusWaiting",
    skipped: "graphStatusSkipped",
}

const wordOf = (locale: NodeLocale, key: string): string => messageNamed(locale, key) ?? key

/** A card map drawn by the Grammar's `FlowGraph layout="steps"`: the step cards and the edges between them. */
export interface StepsFlow {
    /** The step cards, in graph order. */
    readonly nodes: ReadonlyArray<FlowGraphNode>
    /** The edges whose two ends are cards of the map. */
    readonly edges: ReadonlyArray<FlowGraphEdge>
}

/** The step kind of a node of a graph view. */
export const stepKindOf = (node: GraphNodeView): FlowGraphStepKind => STEP_KINDS[node.kind]

/** Whether a name is one of the step icons. */
const isNodeIcon = (name: string): name is NodeIcon => Object.hasOwn(STEP_ICONS, name)

/** The icon of a node: the glyph its card names, or none (the kind's own glyph) for a name the table does not hold. */
const iconOf = (node: GraphNodeView): IconSource | undefined =>
    node.icon !== undefined && isNodeIcon(node.icon) ? STEP_ICONS[node.icon] : undefined

/** The small corner pill of a card: what starts the flow, a step that waits; none for the rest. */
const tagOf = (kind: FlowGraphStepKind, isStart: boolean, locale: NodeLocale): string | undefined => {
    if (kind === "wait") return wordOf(locale, "graphKindWait")
    return isStart && kind === "event" ? wordOf(locale, "graphTagTrigger") : undefined
}

/**
 * The words of the choice a step is set to: the label of the value of its first shown `enum` setting (the intent an intent
 * check looks for, the agent a handoff goes to), so steps of the same node read apart; none for a step without one.
 */
const choiceOf = (node: GraphNodeView): string | undefined => {
    const field = (node.paramFields ?? []).find((one) => !one.hidden && one.input === "enum")
    return field?.options?.find((option) => option.value === field.value)?.label
}

/** A ref written `{ $ref }` without the plumbing: `steps.order.output.id` reads `order.id`. */
const refWords = (ref: string): string => ref.replace(/^steps\./, "").replace(/\.(output|error)\./, ".")

/** The ref text of a setting bound at run time, or null for a fixed value. */
const refOf = (value: unknown): string | null => {
    if (typeof value !== "object" || value === null) return null
    const ref: unknown = Reflect.get(value, "$ref")
    return typeof ref === "string" ? ref : null
}

/** A fixed value in a few characters. */
const valueWords = (value: unknown): string => {
    const text = typeof value === "string" ? value : (JSON.stringify(value) ?? "")
    return text.length > 18 ? `${text.slice(0, 17)}...` : text
}

/** The settings of a step as chips: a ref bound at run time is pink ("= order.id"), a fixed one grey ("label: value"). */
const chipsOf = (node: GraphNodeView): ReadonlyArray<FlowGraphChip> => {
    const written: Readonly<Record<string, unknown>> = node.params ?? {}
    return (node.paramFields ?? [])
        .filter((field) => !field.hidden && written[field.name] !== undefined)
        .map((field): FlowGraphChip => {
            const ref = refOf(written[field.name])
            return ref === null
                ? { label: `${field.label}: ${valueWords(written[field.name])}`, tone: "neutral" }
                : { label: `= ${refWords(ref)}`, tone: "accent" }
        })
}

/** A for-each step as a loop card: its words and the list it walks as a chip, around the nodes of its body. */
const containerOf = (node: GraphNodeView, loop: LoopView): FlowGraphContainer => ({
    label: node.title ?? node.label,
    ...(loop.items === null ? {} : { chips: [{ label: loop.items.text, tone: loop.items.kind === "ref" ? "accent" : "neutral" }] }),
    childIds: loop.bodyKeys,
})

/** One node as a step card: its title, the one line under it, its kind, icon and tag. An end draws as the "Done" pill. */
/** What a node is among its graph: whether it starts the flow, whether it is the main outcome. */
interface NodePlace {
    readonly isStart: boolean
    readonly isMainOutcome: boolean
}

const stepNodeOf = (node: GraphNodeView, place: NodePlace, locale: NodeLocale): FlowGraphNode => {
    const { isStart } = place
    const kind = stepKindOf(node)
    const icon = iconOf(node)
    const tag = tagOf(kind, isStart, locale)
    const base = choiceOf(node) ?? node.subtitle ?? node.description ?? ""
    const chips = kind === "end" ? [] : chipsOf(node)
    return {
        id: node.id,
        label: kind === "end" ? (node.outcome?.label ?? wordOf(locale, "graphStepEnd")) : (node.title ?? node.label),
        ...(kind === "end" && place.isMainOutcome ? { tone: "accent" as const } : {}),
        ...(kind === "end" || base === "" ? {} : { description: base }),
        kind,
        ...(icon === undefined ? {} : { icon }),
        ...(tag === undefined ? {} : { tag }),
        ...(chips.length === 0 ? {} : { chips }),
        ...(node.loop === undefined ? {} : { container: containerOf(node, node.loop) }),
    }
}

/**
 * One edge as the card map draws it. A forward edge out of a condition leaves from the port its words name (the outputs that lead to
 * the same step share one port, "Others" past three), so the branch label lives on the port, not the line; a back edge is dashed and
 * keeps its words as a pill.
 */
const stepEdgeOf = (edge: GraphEdgeView, from: GraphNodeView | undefined): FlowGraphEdge => {
    const words = edge.label ?? edge.condition ?? ""
    if (edge.back === true) {
        return {
            id: edge.id,
            source: edge.from,
            target: edge.to,
            variant: "back",
            ...(words === "" ? {} : { label: words }),
        }
    }
    const isBranch = from !== undefined && stepKindOf(from) === "condition" && words !== ""
    return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        ...(isBranch ? { sourcePort: words } : {}),
    }
}

/**
 * The card map of a graph view (`graphViewOfSpec`): every node as a white step card with its kind, icon, Vietnamese (or English)
 * title and line, the first event tagged as what starts the flow; every edge with the port it leaves and its back variant. The run
 * overlay (`status`, `isTaken`) and the marks of a diff are the caller's to add on top.
 */
export const stepsFlowOf = (view: GraphView, locale: NodeLocale): StepsFlow => {
    const ids = new Set(view.nodes.map((node) => node.id))
    const entered = new Set(view.edges.filter((edge) => edge.back !== true).map((edge) => edge.to))
    const byId = new Map(view.nodes.map((node): [string, GraphNodeView] => [node.id, node]))
    return {
        nodes: view.nodes.map((node, index) =>
            stepNodeOf(
                node,
                {
                    isStart: index === 0 || !entered.has(node.id),
                    isMainOutcome: node.outcome !== undefined && node.outcome.key === view.outcomes?.[0]?.key,
                },
                locale,
            ),
        ),
        edges: view.edges
            .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
            .map((edge) => stepEdgeOf(edge, byId.get(edge.from))),
    }
}

/** The legend under a card map: event, action, condition, wait, in the language asked. */
export const stepsLegendOf = (locale: NodeLocale): ReadonlyArray<FlowGraphLegendItem> =>
    LEGEND.map(([kind, key]) => ({ kind, label: wordOf(locale, key) }))

/** The words of the run statuses a card's accessible name says, in the language asked. */
export const stepsStatusLabelsOf = (locale: NodeLocale): Readonly<Record<FlowGraphRunStatus, string>> => ({
    done: wordOf(locale, STATUS_KEYS.done),
    running: wordOf(locale, STATUS_KEYS.running),
    failed: wordOf(locale, STATUS_KEYS.failed),
    waiting: wordOf(locale, STATUS_KEYS.waiting),
    skipped: wordOf(locale, STATUS_KEYS.skipped),
})
