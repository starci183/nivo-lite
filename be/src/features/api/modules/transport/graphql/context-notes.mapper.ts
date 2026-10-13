import type { ContextNote } from "@modules/domain/module-context-notes"
import type { ContextNotesRequest } from "../../application/context-notes.contracts"
import type { ContextNoteType } from "./dto/context-note.type"
import type { ContextNotesInput } from "./dto/context-notes.input"

/** Maps the GraphQL arguments of contextNotes to the request. */
export const toContextNotesRequest = (workspaceId: string, input: ContextNotesInput): ContextNotesRequest => ({
    workspaceId,
    installationId: input.installationId,
})

/** Maps the pending notes to the GraphQL type. */
export const toContextNotesType = (notes: ReadonlyArray<ContextNote>): Array<ContextNoteType> =>
    notes.map((note) => ({ ...note }))
