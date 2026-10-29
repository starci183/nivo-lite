import type { MockOf } from "@starci/jest-preset"
import type { ThreadMessageAuthorsService, ThreadMessageRead } from "@modules/domain/thread-messages"

/** A message row given a blank author name and role unless the row already carries them (a fixture that names its author keeps it). */
const namedOrBlank = (row: ThreadMessageRead): ThreadMessageRead & { author_name: string; author_role: string } => ({
    author_name: "",
    author_role: "",
    ...row,
})

/** Makes a `mock<ThreadMessageAuthorsService>()` name every message from the row itself, so a spec feeds the names in its fixtures. */
export const namesFromRows = (authors: MockOf<ThreadMessageAuthorsService>): MockOf<ThreadMessageAuthorsService> => {
    authors.withAuthor.mockImplementation((_manager, _workspaceId, row) => Promise.resolve(namedOrBlank(row)))
    authors.withAuthors.mockImplementation((_manager, _workspaceId, rows) => Promise.resolve(rows.map(namedOrBlank)))
    return authors
}
