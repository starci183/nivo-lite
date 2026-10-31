import { builder } from "@starci/jest-preset"
import { brainDossiersEntities } from "@modules/domain/brain-dossiers"

const [BrainDossierEntity] = brainDossiersEntities
type BrainDossierEntity = InstanceType<typeof BrainDossierEntity>

/** The workspace the dossier rows belong to. */
export const DOSSIER_WORKSPACE = "11111111-1111-4111-8111-111111111111"

/** A dossier that is held in full, with every stored column. */
export const dossierRowOf = builder<BrainDossierEntity>({
    id: "d1",
    workspaceId: DOSSIER_WORKSPACE,
    category: "LEGAL FILES",
    categoryOrder: 1,
    position: 1,
    ref: "1",
    name: "Registration certificate",
    status: "present",
    existing: "Certificate",
    missing: null,
    drafts: null,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})
