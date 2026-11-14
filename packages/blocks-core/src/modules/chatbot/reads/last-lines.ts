import type { CustomerLine, CustomerMessages } from "@nivo-lite/agent-sdk/platform"
import { previewOf } from "../../../rules/chatbot"
import type { MessageRole } from "../../../rules/chatbot"

/** How many of a route's newest lines are looked at for the last one that was said (a refused send was never told). */
const LAST_LINE_WINDOW = 5

/** The last line of a conversation as a list shows it: its preview and who said it. */
export interface LastLine {
    /** The preview of the last line said; empty when none was said in the chat's window. */
    readonly lastText: string
    /** Who said it: the customer (`user`) or the shop (`agent`); null when none was said. */
    readonly lastRole: MessageRole | null
}

/** A conversation a list joins its last line to: the route the engine keeps its lines on and the chat's own window. */
export interface LineWindow {
    /** The engine's route of the chat; null on a chat no route was written on yet. */
    readonly routeId: string | null
    /** Where the chat's window on the route's lines starts, as ISO 8601; null for the whole route. */
    readonly startedAt: string | null
}

/** No line said yet. */
const NO_LINE: LastLine = { lastText: "", lastRole: null }

/** Whether a line was said: what the person said, or a send the engine claimed or delivered (a refused or unknown one was not told). */
const wasSaid = (line: CustomerLine): boolean =>
    line.direction === "from_person" || line.state === "claimed" || line.state === "delivered"

/**
 * The last line said on a chat's route within its window, read from the ENGINE's conversation (`platform.customer-messages`, ruling R26):
 * the chat keeps no copy of any line, so every list of chats joins it here, one bounded read per chat of the page.
 */
export const lastLineOf = async (lines: CustomerMessages, chat: LineWindow): Promise<LastLine> => {
    if (chat.routeId === null) return NO_LINE
    const page = await lines.byRoute(chat.routeId, { limit: LAST_LINE_WINDOW, since: chat.startedAt })
    const last = page.lines.find(wasSaid)
    if (last === undefined) return NO_LINE
    return { lastText: previewOf(last.text), lastRole: last.direction === "from_person" ? "user" : "agent" }
}

/** The rows of a page, each with its last line joined, in the same order. */
export const withLastLines = <T extends LineWindow>(
    lines: CustomerMessages,
    rows: ReadonlyArray<T>,
): Promise<ReadonlyArray<T & LastLine>> =>
    Promise.all(rows.map(async (row) => ({ ...row, ...(await lastLineOf(lines, row)) })))
