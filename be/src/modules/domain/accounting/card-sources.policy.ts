import type { HubCardSource } from "./accounting-desk.contracts"
import { CARD_COPY } from "./messages/accounting-desk.messages"

/** One live read of a card: the tool that answered (null when nothing did) and what it was read for. */
export interface ToolUse {
    /** The full name of the tool that answered, or null. */
    readonly tool: string | null
    /** What the tool was read for, as the reader sees it. */
    readonly label: string
}

/** The layer-1 sources of a card: each tool that actually answered, cited by its resolved name; a role nothing answered is left out. */
export const toolSources = (uses: ReadonlyArray<ToolUse>): ReadonlyArray<HubCardSource> =>
    uses.flatMap(({ tool, label }) =>
        tool === null
            ? []
            : [{ layer: 1 as const, kind: "mcp_tool", ref: tool, label: CARD_COPY.toolSource(label, tool) }],
    )
