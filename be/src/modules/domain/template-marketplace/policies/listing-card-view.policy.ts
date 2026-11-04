import { parameterViewOf } from "@modules/domain/agent-templates"
import type { ListingCard, ListingCardView } from "../template-marketplace.contracts"

/** A card the way the catalogue shows it: the settings the buyer fills in carry their defaults as text. */
export const cardViewOf = (card: ListingCard): ListingCardView => ({
    ...card,
    parameters: card.parameters.map((parameter) => parameterViewOf(parameter)),
})
