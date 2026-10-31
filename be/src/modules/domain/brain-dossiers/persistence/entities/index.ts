import { BrainDossierEntity } from "./brain-dossier.entity"

export { BrainDossierEntity }
export type { BrainDossierStatus } from "./brain-dossier.entity"

/** The entities the brain-dossiers capability owns, collected by the database module. */
export const brainDossiersEntities = [BrainDossierEntity] as const
