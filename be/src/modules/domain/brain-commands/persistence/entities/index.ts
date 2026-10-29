import { BrainCommandEntity } from "./brain-command.entity"

export { BrainCommandEntity }

/** The entities the Brain commands capability owns, for the app's connection. */
export const brainCommandsEntities = [BrainCommandEntity] as const
