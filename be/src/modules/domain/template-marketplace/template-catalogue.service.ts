import { Injectable } from "@nestjs/common"
import { cardViewOf } from "./policies/listing-card-view.policy"
import type { ListingCardView } from "./template-marketplace.contracts"
import { TemplateListingsService } from "./template-listings.service"

@Injectable()
/** The catalogue of approved listings next to the built-in modules, in the shape the buyer reads. */
export class TemplateCatalogueService {
    constructor(private readonly listings: TemplateListingsService) {}

    /** The approved listings, newest first, each setting with its default as text. */
    async catalogue(): Promise<ReadonlyArray<ListingCardView>> {
        const cards = await this.listings.catalogue()
        return cards.map((card) => cardViewOf(card))
    }
}
