import type { MessageCardAction } from "@starci/grammar/common"
import type { AgentMessageItem } from "../../agent-message/agent-message-item"
import type { AgentMessageWords } from "./agent-message-words"

/** What the actions are built from: the message, the words, what a person may do and how it is answered. */
export interface ActionsInput {
    readonly item: AgentMessageItem
    readonly words: AgentMessageWords
    /** Where the owner connects what the agent needs; empty when it needs nothing. */
    readonly connectionHref: string
    readonly canApprove: boolean
    readonly canReject: boolean
    readonly canReply: boolean
    readonly isRunning: boolean
    readonly onApprove: () => void
    readonly onEdit: () => void
    readonly onReject: () => void
    readonly onReply: (optionId: string) => void
}

/** The commands of a message that asks for approval: approve (primary), edit in place or at the source, reject. */
const approveActionsOf = (input: ActionsInput): ReadonlyArray<MessageCardAction> => {
    const { words, item } = input
    const kindActions = item.kind?.actions
    const source = item.record.detailHref
    const list: Array<MessageCardAction> = []
    if (input.canApprove && kindActions?.approve !== false) {
        list.push({ id: "approve", kind: "primary", label: words.approve, isPending: input.isRunning, onPress: input.onApprove })
    }
    if (input.canApprove && kindActions?.edit === "inline") {
        list.push({ id: "edit", label: words.edit, onPress: input.onEdit })
    }
    if (input.canApprove && kindActions?.edit === "source" && source !== "") {
        list.push({ id: "edit", kind: "open", label: words.edit, href: source })
    }
    if (input.canReject && kindActions?.reject !== false) {
        list.push({ id: "reject", label: words.reject, onPress: input.onReject })
    }
    return list
}

/** What a person may do while the message waits; none for a notice or a report. */
const commandsOf = (input: ActionsInput): ReadonlyArray<MessageCardAction> => {
    const { item } = input
    if (!item.isOpen) return []
    if (item.intent === "approve") return approveActionsOf(input)
    if (item.intent !== "ask" || !input.canReply) return []
    return item.record.options.map((option) => ({
        id: option.id,
        label: option.label,
        onPress: () => input.onReply(option.id),
    }))
}

/** Where the message leads: the connection it needs, then the related work; both end in the arrow. */
const leadsOf = (input: ActionsInput): ReadonlyArray<MessageCardAction> => {
    const { work } = input.item.record
    const { words } = input
    const list: Array<MessageCardAction> = []
    if (input.connectionHref !== "") {
        list.push({ id: "connections", kind: "open", label: words.kinds.openConnections, href: input.connectionHref })
    }
    if (work !== undefined && work.href !== "") {
        const label = words.openWork === "" ? work.label : `${words.openWork} ${work.label}`
        list.push({ id: "work", kind: "open", label, href: work.href })
    }
    return list
}

/** The actions row of the card as data: the primary first, the secondary after it, what the message leads to last (Grammar sorts them). */
export const actionsOf = (input: ActionsInput): ReadonlyArray<MessageCardAction> => [
    ...commandsOf(input),
    ...leadsOf(input),
]
