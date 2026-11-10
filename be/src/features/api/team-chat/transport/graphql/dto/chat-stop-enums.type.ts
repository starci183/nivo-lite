import { registerEnumType } from "@nestjs/graphql"

/** Which stop a `workflow.stopped` card is: the AI reports with intent, NIVO reports the AI failed, or a call waits for permission. */
export const ChatStopKind = { ai_report: "ai_report", ai_error: "ai_error", approval: "approval" }

registerEnumType(ChatStopKind, { name: "ChatStopKind" })

/** Where the stop of a card stands. */
export const ChatStopState = {
    open: "open",
    answered: "answered",
    skipped: "skipped",
    timed_out: "timed_out",
    resolved: "resolved",
}

registerEnumType(ChatStopState, { name: "ChatStopState" })

/** A button of a stop the engine accepts (the web owns its label). */
export const ChatStopDecision = { retry: "retry", take_over: "take_over", skip: "skip" }

registerEnumType(ChatStopDecision, { name: "ChatStopDecision" })

/** A verdict of a permission request (the web owns its label). */
export const ChatStopVerdict = { approve: "approve", refuse: "refuse" }

registerEnumType(ChatStopVerdict, { name: "ChatStopVerdict" })

/** What a reply on a stop card was. */
export const ChatStopReplyKind = {
    answer: "answer",
    retry: "retry",
    take_over: "take_over",
    skip: "skip",
    timeout: "timeout",
    approve: "approve",
    refuse: "refuse",
}

registerEnumType(ChatStopReplyKind, { name: "ChatStopReplyKind" })

/** Who worded the reason of a stop: the AI, or NIVO when the AI failed. */
export const ChatStopAuthor = { ai: "ai", engine: "engine" }

registerEnumType(ChatStopAuthor, { name: "ChatStopAuthor" })

/** Who carries a suggested way on: the workflow runs again, or a person does it. */
export const ChatStopHandler = { workflow: "workflow", person: "person" }

registerEnumType(ChatStopHandler, { name: "ChatStopHandler" })
