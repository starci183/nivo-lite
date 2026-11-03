import { ContentBrandProposalEntity } from "./content-brand-proposal.entity"

export { ContentBrandProposalEntity }

/** The entities the content brand proposals capability owns, for the app's connection. */
export const contentBrandProposalsEntities: readonly [typeof ContentBrandProposalEntity] = [
    ContentBrandProposalEntity,
] as const
