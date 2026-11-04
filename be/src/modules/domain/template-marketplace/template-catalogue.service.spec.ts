import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TemplateCatalogueService } from "./template-catalogue.service"
import { TemplateListingsService } from "./template-listings.service"
import type { ListingCard } from "./template-marketplace.contracts"

const CARD: ListingCard = {
    id: "listing-1",
    templateKey: "spa-booking-by-linh",
    version: 1,
    name: { vi: "Dat lich spa", en: "Spa booking" },
    summary: { vi: "Quy trinh cua Linh", en: "Linh process" },
    points: [],
    category: "operations",
    publisherName: "Linh",
    firstParty: false,
    priceVnd: 0,
    parameters: [
        {
            key: "shop",
            kind: "text",
            label: { vi: "Ten shop", en: "Shop" },
            hint: null,
            min: null,
            max: null,
            required: true,
            default: "Spa",
        },
    ],
    requiredProviders: [],
    requiredAuthorityActions: [],
    personName: null,
}

const build = async () => {
    const listings = mock<TemplateListingsService>({ catalogue: jest.fn().mockResolvedValue([CARD]) })
    const moduleRef = await Test.createTestingModule({
        providers: [TemplateCatalogueService, { provide: TemplateListingsService, useValue: listings }],
    }).compile()
    return { service: moduleRef.get(TemplateCatalogueService), listings }
}

describe("TemplateCatalogueService", () => {
    it("lists the approved listings with the default of each setting as text", async () => {
        const { service, listings } = await build()

        const cards = await service.catalogue()

        expect(listings.catalogue).toHaveBeenCalledTimes(1)
        expect(cards).toEqual([
            { ...CARD, parameters: [expect.objectContaining({ key: "shop", defaultValue: "Spa" })] },
        ])
    })
})
