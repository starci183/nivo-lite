import type { SetupMessage } from "@/modules/installations"

/** The category value that means every category. */
export const ALL_CATEGORIES = "all"

/** Oldest first. */
export const byTime = (a: SetupMessage, b: SetupMessage): number => a.createdAt.localeCompare(b.createdAt)

/** The current messages with the incoming ones: a message with a known id is replaced, the rest are added, oldest first. */
export const mergeMessages = (
    current: ReadonlyArray<SetupMessage>,
    incoming: ReadonlyArray<SetupMessage>,
): Array<SetupMessage> => {
    const byId = new Map(current.map((message) => [message.id, message]))
    for (const message of incoming) byId.set(message.id, message)
    return [...byId.values()].sort(byTime)
}
