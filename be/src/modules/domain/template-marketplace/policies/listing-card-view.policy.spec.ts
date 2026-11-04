import { Test } from "@nestjs/testing"
import type { ListingCard } from "../template-marketplace.contracts"
import { cardViewOf } from "./listing-card-view.policy"

const SUBJECT = Symbol("listing-card-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cardViewOf } }],
    }).compile()
    return moduleRef.get<{ cardViewOf: typeof cardViewOf }>(SUBJECT)
}

const CARD: ListingCard = {
    id: "listing-1",
    templateKey: "spa-booking-by-linh",
    version: 2,
    name: { vi: "Dat lich spa", en: "Spa booking" },
    summary: { vi: "Quy trinh cua Linh", en: "Linh process" },
    points: [],
    category: "operations",
    publisherName: "Linh",
    firstParty: false,
    priceVnd: 0,
    parameters: [
        {
            key: "limit",
            kind: "number",
            label: { vi: "Muc", en: "Limit" },
            hint: null,
            min: 1,
            max: 9,
            required: true,
            default: 5,
        },
        {
            key: "auto",
            kind: "toggle",
            label: { vi: "Tu chay", en: "Auto" },
            hint: null,
            min: null,
            max: null,
            required: false,
            default: true,
        },
    ],
    requiredProviders: ["zalo"],
    requiredAuthorityActions: [],
    personName: null,
}

describe("listing-card-view.policy", () => {
    it("keeps the card and shows the default of each setting as text", async () => {
        const subject = await build()

        const view = subject.cardViewOf(CARD)

        expect(view).toEqual({
            ...CARD,
            parameters: [
                expect.objectContaining({ key: "limit", defaultValue: "5" }),
                expect.objectContaining({ key: "auto", defaultValue: "true" }),
            ],
        })
    })
})
