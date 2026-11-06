import { textOf, valueAt } from "../../slots/paths"
import type { ProposalPaths, ProposalRow } from "./conversation.types"

/** The text at an optional path of a record; nothing without a path. */
const textAt = (record: unknown, path: string | undefined): string =>
    path === undefined ? "" : textOf(valueAt(record, path))

/** The reply proposed in a record: nothing when the record has no id or no words. */
export const proposalOf = (record: unknown, paths: ProposalPaths): ProposalRow | null => {
    const id = textOf(valueAt(record, paths.idPath))
    const text = textOf(valueAt(record, paths.textPath))
    if (id === "" || text === "") return null
    return { id, text, asked: textAt(record, paths.askedPath), note: textAt(record, paths.notePath) }
}
