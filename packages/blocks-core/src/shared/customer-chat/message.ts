/** Who wrote a message line. */
export type MessageRole = "user" | "agent" | "system"

/** Whose message it is, as the thread block draws it. */
export type MessageSide = "incoming" | "outgoing" | "notice"

/** Who wrote an agent line: the AI, or a person of the workspace. */
export type AuthorKind = "ai" | "human"

/** How far a line of the agent travelled, in the words the thread block reads; empty draws no mark. */
export type DeliveryWord = "" | "queued" | "sent" | "failed"

/** The longest preview of a conversation's last line. */
export const PREVIEW_MAX = 140

/** The message's conversational role, normalized to the three supported roles. */
export const roleOf = (role: string): MessageRole => (role === "agent" || role === "system" ? role : "user")

/** The side of the thread a role stands on: the customer's lines are incoming, the agent's outgoing, the system's notices. */
export const sideOf = (role: MessageRole): MessageSide => {
    if (role === "agent") return "outgoing"
    return role === "system" ? "notice" : "incoming"
}

/** Who wrote an agent line: a person only when the line says so. */
export const authorKindOf = (kind: string | null): AuthorKind => (kind === "human" ? "human" : "ai")

/**
 * How far a line travelled. Only the agent's lines have a delivery: a pushed line is sent or failed, a line a person wrote that is
 * not pushed yet is queued, and an AI line that was not pushed draws no mark.
 */
export const deliveryWordOf = (role: MessageRole, authorKind: AuthorKind, status: string | null): DeliveryWord => {
    if (role !== "agent") return ""
    if (status === "sent" || status === "failed") return status
    return authorKind === "human" ? "queued" : ""
}

/** The short marker beside the author of an agent line the AI wrote. */
export const markOf = (role: MessageRole, authorKind: AuthorKind): string =>
    role === "agent" && authorKind === "ai" ? "AI" : ""

/** The preview of a line: the text, cut to 140 characters with an ellipsis. */
export const previewOf = (body: string): string =>
    body.length > PREVIEW_MAX ? `${body.slice(0, PREVIEW_MAX - 1).trimEnd()}...` : body
