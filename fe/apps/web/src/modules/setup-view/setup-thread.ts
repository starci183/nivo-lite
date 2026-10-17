import type { SetupWrite } from "@/modules/types"
import type { ContextVersion, SetupMessage, SetupRevision } from "@/modules/installations"

/** One message of the thread with the cards that sit under it. */
type ThreadMessage = {
    readonly message: SetupMessage
    readonly cards: ReadonlyArray<SetupWrite>
}

/** One revision of the thread: its messages and, when it was applied, the line that closes it. */
type ThreadGroup = {
    readonly id: string
    readonly messages: ReadonlyArray<ThreadMessage>
    readonly divider: string
}

/** How the divider of an applied revision reads. */
type DividerWords = {
    readonly applied: (revision: number, appliedAt: string, appliedBy: string) => string
    readonly appliedPlain: (revision: number) => string
}

/**
 * The whole history of the chat, one group per revision (oldest first); an applied revision ends with its divider, the open draft
 * continues below. The cards of a message of the owner sit under the reply of NIVO to it (the next assistant message).
 */
export const setupThreadOf = (
    revisions: ReadonlyArray<SetupRevision>,
    messages: ReadonlyArray<SetupMessage>,
    writes: ReadonlyArray<SetupWrite>,
    versions: ReadonlyArray<ContextVersion>,
    draftId: string,
    words: DividerWords,
): ReadonlyArray<ThreadGroup> => {
    const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const cardsAt = new Map<string, Array<SetupWrite>>()
    sorted.forEach((message, index) => {
        if (message.role !== "user") return
        const own = writes.filter((write) => write.sourceMessageId === message.id)
        if (own.length === 0) return
        const reply = sorted.slice(index + 1).find((candidate) => candidate.role === "assistant")
        const at = (reply ?? message).id
        cardsAt.set(at, [...(cardsAt.get(at) ?? []), ...own])
    })
    return revisions.flatMap((revision): Array<ThreadGroup> => {
        const own = sorted.filter((message) => message.setupSessionId === revision.id)
        const threadMessages = own.map((message) => ({ message, cards: cardsAt.get(message.id) ?? [] }))
        if (revision.id === draftId) return [{ id: revision.id, messages: threadMessages, divider: "" }]
        if (own.length === 0) return []
        const version = versions.find((candidate) => candidate.version === revision.revision)
        const divider = version
            ? words.applied(revision.revision, version.appliedAt, version.appliedBy)
            : words.appliedPlain(revision.revision)
        return [{ id: revision.id, messages: threadMessages, divider }]
    })
}
