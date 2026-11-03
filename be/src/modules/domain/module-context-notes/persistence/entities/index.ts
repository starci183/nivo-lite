import { ModuleContextNoteEntity } from "./module-context-note.entity"

export { ModuleContextNoteEntity }

/** The entities of the module-context-notes capability, registered on the primary connection. */
export const moduleContextNotesEntities: readonly [typeof ModuleContextNoteEntity] = [ModuleContextNoteEntity] as const
