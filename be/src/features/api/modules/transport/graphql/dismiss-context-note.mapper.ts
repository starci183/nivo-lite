import type { DismissContextNoteRequest } from "../../application/dismiss-context-note.contracts"
import type { DismissContextNoteInput } from "./dto/dismiss-context-note.input"

/** Maps the GraphQL arguments of dismissContextNote to the request. */
export const toDismissContextNoteRequest = (
    workspaceId: string,
    input: DismissContextNoteInput,
): DismissContextNoteRequest => ({
    workspaceId,
    noteId: input.noteId,
})
