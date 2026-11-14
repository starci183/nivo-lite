/*
 * The words of a tool as a person reads them (tools.md, "Naming"): every NIVO verb starts with `nivo`, so the first segment names
 * nothing; a verb is `nivo.api.<provider>.<op>`, `nivo.tool.<purpose>` or `nivo.trigger.<purpose>` and its words are declared once, with
 * the tool, in the blocks-core vocabulary (`TOOL_LABELS`). This view reads the words BY THE WHOLE ID from where labels live, handed in
 * as `labelOf`, and never derives a name from a segment of the id; an id no label names gets the caller's general phrase, never the id.
 */

/** The owner-facing words of one tool, as the blocks-core vocabulary declares them (`ToolLabel`, the members this view reads). */
export interface ToolLabelWords {
    readonly title: { readonly vi: string; readonly en: string }
}

/** Where the labels live: the words of a tool id, or null for an id the vocabulary does not name. */
export type ToolLabelSource = (id: string) => ToolLabelWords | null

/** The words to show for a tool in the reader's language: its title, else `fallback` (a general phrase, never the id). */
export const toolWordOf = (id: string, locale: "vi" | "en", labelOf: ToolLabelSource, fallback: string): string =>
    labelOf(id)?.title[locale] ?? fallback
