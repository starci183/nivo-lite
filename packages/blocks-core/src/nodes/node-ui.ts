import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { messageNamed } from "../messages/catalog"
import type { NodeLocale } from "./node-schema.types"

/**
 * What a step of a graph is to its owner, in the order the card style draws them:
 * `event` a trigger, or a hand-off / notice to another agent; `action` work the agent does itself; `condition` a branch;
 * `wait` a timed wait; `end` the end. No step waits for the owner's decision: an approval lives inside the tool that needs it.
 */
export const NODE_KINDS: readonly ["event", "action", "condition", "wait", "end"] = [
    "event",
    "action",
    "condition",
    "wait",
    "end",
]

/** One kind of step. */
export type NodeKind = (typeof NODE_KINDS)[number]

/** The icon names a step may take: neutral words, each one a Heroicons glyph the app's Icon leaf draws (see `NODE_HEROICONS`). */
export const NODE_ICONS: readonly [
    "bolt",
    "bank",
    "search",
    "git-branch",
    "scale",
    "user-question",
    "clock",
    "receipt",
    "send",
    "message",
    "bell",
    "book",
    "sparkles",
    "user",
    "pencil",
    "qr",
    "table",
    "chart",
    "flag",
    "hash",
    "bag",
    "photo",
    "warning",
    "check",
    "heart",
    "truck",
    "gift",
    "hand",
] = [
    "bolt",
    "bank",
    "search",
    "git-branch",
    "scale",
    "user-question",
    "clock",
    "receipt",
    "send",
    "message",
    "bell",
    "book",
    "sparkles",
    "user",
    "pencil",
    "qr",
    "table",
    "chart",
    "flag",
    "hash",
    "bag",
    "photo",
    "warning",
    "check",
    "heart",
    "truck",
    "gift",
    "hand",
]

/** One icon name. */
export type NodeIcon = (typeof NODE_ICONS)[number]

/** The export of `@heroicons/react/24/outline` each icon name stands for: the glyph the app hands to Grammar's `Icon` as `source`. */
export const NODE_HEROICONS: Readonly<Record<NodeIcon, string>> = {
    bolt: "BoltIcon",
    bank: "BuildingLibraryIcon",
    search: "MagnifyingGlassIcon",
    "git-branch": "ShareIcon",
    scale: "ScaleIcon",
    "user-question": "QuestionMarkCircleIcon",
    clock: "ClockIcon",
    receipt: "ReceiptPercentIcon",
    send: "PaperAirplaneIcon",
    message: "ChatBubbleLeftRightIcon",
    bell: "BellIcon",
    book: "BookOpenIcon",
    sparkles: "SparklesIcon",
    user: "UserIcon",
    pencil: "PencilSquareIcon",
    qr: "QrCodeIcon",
    table: "TableCellsIcon",
    chart: "ChartBarIcon",
    flag: "FlagIcon",
    hash: "HashtagIcon",
    bag: "ShoppingBagIcon",
    photo: "PhotoIcon",
    warning: "ExclamationTriangleIcon",
    check: "CheckBadgeIcon",
    heart: "HeartIcon",
    truck: "TruckIcon",
    gift: "GiftIcon",
    hand: "HandRaisedIcon",
}

/** The kind and icon of one step. */
export interface NodeUiEntry {
    /** What the step is to its owner. */
    readonly kind: NodeKind
    /** The icon drawn on the step. */
    readonly icon: NodeIcon
}

/** The id of the pseudo step that stands for what wakes a graph. */
export const TRIGGER_STEP = "trigger"

/** The id of the built-in step that ends a run (the same word the graph specs write). */
export const STOP_STEP_ID = "stop"

/**
 * The kind and icon of every step of the Chatbot, Sales, Accounting and Nivo graphs, by node id, plus the trigger and the built-in `stop`.
 * The SDK's node definition has no field for them, so they live here, once; the spec of this file fails when a core node has no entry.
 */
export const NODE_UI: Readonly<Record<string, NodeUiEntry>> = {
    "trigger": { kind: "event", icon: "bolt" },
    "stop": { kind: "end", icon: "flag" },
    "chatbot.understand": { kind: "condition", icon: "sparkles" },
    "chatbot.answer": { kind: "action", icon: "message" },
    "chatbot.complaint": { kind: "action", icon: "warning" },
    "core.call-workflow": { kind: "event", icon: "send" },
    "core.for-each": { kind: "action", icon: "git-branch" },
    "core.outcome": { kind: "end", icon: "flag" },
    "core.if": { kind: "condition", icon: "git-branch" },
    "sales.consult-turn": { kind: "action", icon: "message" },
    "sales.create-order": { kind: "action", icon: "bag" },
    "payment.request": { kind: "action", icon: "qr" },
    "sales.order-notice": { kind: "event", icon: "bell" },
    "sales.web-order": { kind: "action", icon: "bag" },
    "sales.after-sale": { kind: "action", icon: "heart" },
    "sales.care-plan": { kind: "wait", icon: "clock" },
    "sales.care-delivery-check": { kind: "action", icon: "truck" },
    "sales.care-occasion": { kind: "action", icon: "gift" },
    "sales.payment-reminder": { kind: "action", icon: "clock" },
    "sales.unpaid-notice": { kind: "event", icon: "bell" },
    "payment.received-notice": { kind: "event", icon: "bell" },
    "accounting.match-payment": { kind: "action", icon: "sparkles" },
    "payment.settle": { kind: "action", icon: "receipt" },
    "accounting.post-payment": { kind: "action", icon: "table" },
    "accounting.report": { kind: "action", icon: "chart" },
    "team.chat": { kind: "action", icon: "message" },
}

/** The words of a node id as a name part: `payment.match-code` is `PaymentMatchCode`, `no_match` is `NoMatch`. */
export const namePartOf = (id: string): string =>
    id
        .split(/[.\-_]/u)
        .filter((part) => part !== "")
        .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
        .join("")

/** The kind and icon of a step; an unlisted step is a plain action. */
export const nodeUiOf = (id: string): NodeUiEntry => NODE_UI[id] ?? { kind: "action", icon: "sparkles" }

/** The text of a spec text in one language; a key the catalog does not hold answers itself. */
export const specTextOf = (text: NodeDefinition["title"], locale: NodeLocale): string =>
    "key" in text ? (messageNamed(locale, text.key) ?? text.key) : text[locale]

/** The short name of a step in one language. */
export const nodeTitleOf = (node: NodeDefinition | { readonly id: string }, locale: NodeLocale): string =>
    "title" in node
        ? specTextOf(node.title, locale)
        : (messageNamed(locale, `node${namePartOf(node.id)}Title`) ?? node.id)

/** The line under a step's name in one language: what the step does, never its title again. */
export const nodeSubtitleOf = (id: string, locale: NodeLocale): string =>
    messageNamed(locale, `node${namePartOf(id)}Subtitle`) ?? ""

/**
 * What a step is for, in one sentence, in one language: the goal the agent runs with and the engine wrapper hands to the AI core when the
 * step cannot complete (`node<Id>Goal` in the catalog); empty when the catalog has none.
 */
export const nodeGoalOf = (id: string, locale: NodeLocale): string => messageNamed(locale, `node${namePartOf(id)}Goal`) ?? ""

/** The branch ids of a node's output, in the order its schema lists them; none when the output has no `branch` of fixed words. */
export const branchesOf = (node: NodeDefinition): ReadonlyArray<string> => {
    const schema = z.toJSONSchema(node.output, { io: "output", unrepresentable: "any" })
    const branch: unknown = schema["properties"]?.["branch"]
    const values: unknown = typeof branch === "object" && branch !== null ? Reflect.get(branch, "enum") : undefined
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string") : []
}

/** The label of one branch of a condition in one language; the branch id when the catalog has no words for it. */
export const branchLabelOf = (id: string, branch: string, locale: NodeLocale): string =>
    messageNamed(locale, `node${namePartOf(id)}Output${namePartOf(branch)}`) ??
    messageNamed(locale, `nodeOutput${namePartOf(branch)}`) ??
    branch
