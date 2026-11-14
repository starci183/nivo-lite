import { aiCallLabelOf as aiCallLabelWith, namePartOf } from "@nivo-lite/agent-sdk/graph"
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

/**
 * A step as the editor and the graph views read it: a package node (`defineNode`, the control steps) or a template node
 * (`defineTemplateNode`), by what both carry. A template node that routes names its routes.
 */
export interface ViewNode {
    /** The node id. */
    readonly id: string
    /** The words the editor shows. */
    readonly title: NodeDefinition["title"]
    /** The schema of the input. */
    readonly input: z.ZodType
    /** The schema of the output. */
    readonly output: z.ZodType
    /** The schema of the settings; absent: none. */
    readonly params?: z.ZodType | undefined
    /** The output member that names the route and the route names, of a template node that routes. */
    readonly routes?: { readonly by: string; readonly names: ReadonlyArray<string> } | undefined
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
 * The step ids the ENGINE runs a template graph's control steps under once it installed the graph (its @1 adapter writes them): a
 * condition (`ifNode`), a wait, an `until` loop and a hand-back. They are no node of this package, yet the map draws them, so each has its
 * own card here (kind, icon, words); the graph's own `label` names the one step.
 */
export const ENGINE_STEP = {
    when: "core.when",
    wait: "core.wait",
    until: "core.until",
    handBack: "core.hand-back",
} as const

/** The engine's control step ids, as a list. */
export const ENGINE_STEP_IDS: ReadonlyArray<string> = Object.values(ENGINE_STEP)

/** The id of the neutral card a step this package does not know is drawn with: never the trigger's card. */
export const STEP_CARD_ID = "step"

/**
 * The kind and icon of every step of the Chatbot, Sales, Accounting and Nivo graphs, by node id, plus the trigger and the built-in `stop`.
 * The SDK's node definitions have no field for them, so they live here, once; the spec of this file fails when an installed step (a
 * control node or a template node) has no entry.
 */
export const NODE_UI: Readonly<Record<string, NodeUiEntry>> = {
    trigger: { kind: "event", icon: "bolt" },
    stop: { kind: "end", icon: "flag" },
    "core.call-workflow": { kind: "event", icon: "send" },
    "core.for-each": { kind: "action", icon: "git-branch" },
    "core.outcome": { kind: "end", icon: "flag" },
    "core.if": { kind: "condition", icon: "git-branch" },
    "core.when": { kind: "condition", icon: "git-branch" },
    "core.wait": { kind: "wait", icon: "clock" },
    "core.until": { kind: "action", icon: "git-branch" },
    "core.hand-back": { kind: "event", icon: "send" },
    step: { kind: "action", icon: "sparkles" },
    "chatbot.hear": { kind: "condition", icon: "message" },
    "chatbot.understand": { kind: "condition", icon: "sparkles" },
    "chatbot.answer": { kind: "action", icon: "message" },
    "chatbot.complaint-reply": { kind: "action", icon: "warning" },
    "chatbot.complaint-notify": { kind: "event", icon: "bell" },
    "team.chat": { kind: "action", icon: "message" },
    "team.truth-propose": { kind: "action", icon: "book" },
    "team.answer-post": { kind: "action", icon: "send" },
    "team.declined-notice": { kind: "event", icon: "bell" },
    "sales.consult-turn": { kind: "action", icon: "message" },
    "sales.occasion-keep": { kind: "action", icon: "gift" },
    "sales.order-cancel": { kind: "action", icon: "warning" },
    "sales.order-cancel-tell": { kind: "action", icon: "send" },
    "sales.cancel-paid-notice": { kind: "event", icon: "bell" },
    "sales.order-create": { kind: "action", icon: "bag" },
    "sales.order-tell": { kind: "action", icon: "send" },
    "sales.request-qr": { kind: "action", icon: "qr" },
    "sales.order-talk": { kind: "condition", icon: "message" },
    "sales.order-read": { kind: "action", icon: "bag" },
    "sales.payment-remind": { kind: "action", icon: "send" },
    "sales.credit-read": { kind: "action", icon: "bag" },
    "sales.credit-notice": { kind: "event", icon: "bell" },
    "sales.not-sale-notice": { kind: "event", icon: "bell" },
    "sales.paid-claim-reply": { kind: "action", icon: "send" },
    "sales.paid-claim-notice": { kind: "event", icon: "bell" },
    "sales.awaiting-orders": { kind: "action", icon: "bag" },
    "sales.order-paid": { kind: "action", icon: "check" },
    "sales.payment-short": { kind: "action", icon: "send" },
    "sales.credit-tally": { kind: "action", icon: "check" },
    "sales.after-sale": { kind: "action", icon: "heart" },
    "sales.consult-stage": { kind: "action", icon: "heart" },
    "sales.care-plan-delivery": { kind: "wait", icon: "truck" },
    "sales.care-plan-occasions": { kind: "wait", icon: "gift" },
    "sales.care-delivery-wait": { kind: "wait", icon: "clock" },
    "sales.care-delivery-check": { kind: "action", icon: "truck" },
    "sales.care-occasion-wait": { kind: "wait", icon: "clock" },
    "sales.care-occasion": { kind: "action", icon: "gift" },
    "sales.care-occasion-rearm": { kind: "wait", icon: "gift" },
    "sales.web-order-lead": { kind: "action", icon: "user" },
    "sales.web-order-keep": { kind: "action", icon: "bag" },
    "sales.web-order-notice": { kind: "event", icon: "bell" },
    "booking.find-slots": { kind: "action", icon: "clock" },
    "booking.book": { kind: "condition", icon: "message" },
    "booking.confirm": { kind: "condition", icon: "flag" },
    "booking.confirm-tell": { kind: "condition", icon: "send" },
    "booking.confirm-notify": { kind: "action", icon: "bell" },
    "booking.remind": { kind: "action", icon: "bell" },
    "hiring.screen": { kind: "action", icon: "sparkles" },
    "hiring.notify": { kind: "event", icon: "bell" },
    "hiring.invite": { kind: "action", icon: "send" },
    "hiring.invite-move": { kind: "action", icon: "user" },
    "hiring.digest": { kind: "action", icon: "chart" },
    "video.script": { kind: "action", icon: "pencil" },
    "video.voice": { kind: "action", icon: "message" },
    "video.scenes": { kind: "action", icon: "sparkles" },
    "video.result": { kind: "wait", icon: "clock" },
    "video.keep": { kind: "action", icon: "photo" },
    "video.links": { kind: "action", icon: "git-branch" },
    "video.compose": { kind: "action", icon: "sparkles" },
    "video.render-check": { kind: "wait", icon: "clock" },
    "video.output": { kind: "action", icon: "photo" },
    "video.review": { kind: "event", icon: "bell" },
    "video.publish": { kind: "action", icon: "check" },
    "video.stuck": { kind: "event", icon: "warning" },
    "content.plan": { kind: "action", icon: "sparkles" },
    "content.draft": { kind: "action", icon: "pencil" },
    "content.review": { kind: "action", icon: "check" },
    "content.approved-notice": { kind: "event", icon: "bell" },
    "content.report": { kind: "action", icon: "chart" },
}

/** The words of a node id as a name part: NIVO core (`@nivo-lite/agent-sdk/graph`), re-exported for this package. */
export { namePartOf }

/** The kind and icon of a step; an unlisted step is a plain action. */
export const nodeUiOf = (id: string): NodeUiEntry => NODE_UI[id] ?? { kind: "action", icon: "sparkles" }

/** The text of a spec text in one language; a key the catalog does not hold answers itself. */
export const specTextOf = (text: NodeDefinition["title"], locale: NodeLocale): string =>
    "key" in text ? (messageNamed(locale, text.key) ?? text.key) : text[locale]

/** The short name of a step in one language. */
export const nodeTitleOf = (node: ViewNode | { readonly id: string }, locale: NodeLocale): string =>
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
export const nodeGoalOf = (id: string, locale: NodeLocale): string =>
    messageNamed(locale, `node${namePartOf(id)}Goal`) ?? ""

/**
 * The branch ids of a step: a template node's route names, in the order it declares them; else the `branch` of a node's output, in the
 * order its schema lists them; none when the step neither routes nor has a `branch` of fixed words.
 */
export const branchesOf = (node: ViewNode): ReadonlyArray<string> => {
    if (node.routes !== undefined) return [...node.routes.names]
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

/**
 * The words of one kind of AI call of a run, for the run page's "AI calls" table, in one language: the structure is NIVO core
 * (`aiCallLabelOf` in `@nivo-lite/agent-sdk/graph`), the words are this package's catalog; null when the catalog has none.
 */
export const aiCallLabelOf = (purpose: string, locale: NodeLocale): string | null =>
    aiCallLabelWith(purpose, (key) => messageNamed(locale, key))
