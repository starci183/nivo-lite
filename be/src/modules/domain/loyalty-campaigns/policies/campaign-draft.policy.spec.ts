import { Test } from "@nestjs/testing"
import type { CampaignParams } from "../loyalty-campaigns.contracts"
import { campaignDraftPrompt, campaignDraftText } from "./campaign-draft.policy"

const SUBJECT = Symbol("campaign-draft.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { campaignDraftPrompt, campaignDraftText } }],
    }).compile()
    return moduleRef.get<typeof import("./campaign-draft.policy")>(SUBJECT)
}

const params: CampaignParams = {
    workspaceId: "workspace-1",
    name: "Autumn thanks",
    segment: { tiers: ["silver"], inactiveDays: 30, birthdayThisMonth: false, minSpendVnd: 500_000 },
    brief: "  Free tea with each visit  ",
    createdBy: "Owner",
}
const TEMPLATE = "{ten_khach}, thank you from {ten_shop}."

describe("campaign-draft.policy campaignDraftPrompt", () => {
    it("provides the message constraints and exactly the owner's offer, segment and business template", async () => {
        const subject = await build()

        expect(subject.campaignDraftPrompt(params, TEMPLATE)).toEqual([
            {
                role: "system",
                content: [
                    [
                        "Write one Vietnamese loyalty promotion message for a customer chat, warm and plain, at ",
                        "most 60 words.",
                    ].join(""),
                    "Start with {ten_khach}. Only {ten_khach}, {ten_shop}, {diem} and {hang} placeholders are allowed.",
                    [
                        "Use no markdown. Mention only the owner's offer. Never invent a discount, gift, price, ",
                        "date or condition.",
                    ].join(""),
                    [
                        "If the owner supplied no offer, write a friendly thank-you without an offer. End with one ",
                        "easy next step.",
                    ].join(""),
                    [
                        "Output only the message. The template supplies the accurate business name; its wording is ",
                        "not an extra offer.",
                    ].join(""),
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    "Campaign name: Autumn thanks",
                    [
                        'Target segment: {"tiers":["silver"],"inactiveDays":30,"birthdayThisMonth":false,"',
                        'minSpendVnd":500000}',
                    ].join(""),
                    "Owner's offer: Free tea with each visit",
                    `Business template: ${TEMPLATE}`,
                ].join("\n"),
            },
        ])
    })

    it("explicitly marks a blank offer as absent", async () => {
        const subject = await build()

        expect(subject.campaignDraftPrompt({ ...params, brief: " \n\t " }, TEMPLATE)[1]).toEqual({
            role: "user",
            content: [
                "Campaign name: Autumn thanks",
                'Target segment: {"tiers":["silver"],"inactiveDays":30,"birthdayThisMonth":false,"minSpendVnd":500000}',
                "Owner's offer: (none)",
                `Business template: ${TEMPLATE}`,
            ].join("\n"),
        })
    })
})

describe("campaign-draft.policy campaignDraftText", () => {
    it("trims whitespace and surrounding quotation marks while retaining the permitted placeholders", async () => {
        const subject = await build()

        expect(subject.campaignDraftText('  " {ten_khach}, {ten_shop}: {diem} points, {hang}. "  ', TEMPLATE)).toBe(
            "{ten_khach}, {ten_shop}: {diem} points, {hang}.",
        )
        expect(subject.campaignDraftText("'{ten_khach}, thank you.'", TEMPLATE)).toBe("{ten_khach}, thank you.")
        expect(subject.campaignDraftText("“{ten_khach}, thank you.”", TEMPLATE)).toBe("{ten_khach}, thank you.")
    })

    it.each([null, "", " \n ", '""'])("keeps the template for empty model output %p", async (output) => {
        const subject = await build()

        expect(subject.campaignDraftText(output, TEMPLATE)).toBe(TEMPLATE)
    })

    it("accepts the length limit and keeps the template for a longer message", async () => {
        const subject = await build()

        const limit = `{ten_khach}${"x".repeat(689)}`

        expect(subject.campaignDraftText(limit, TEMPLATE)).toBe(limit)
        expect(subject.campaignDraftText(`${limit}x`, TEMPLATE)).toBe(TEMPLATE)
    })

    it.each(["{ten_khach}, **thank you**.", "{ten_khach}, thank you.\n# Heading", "{ten_khach}, ```thank you```."])(
        "keeps the template for markdown output %p",
        async (output) => {
            const subject = await build()

            expect(subject.campaignDraftText(output, TEMPLATE)).toBe(TEMPLATE)
        },
    )

    it("keeps the template when the customer name placeholder is missing", async () => {
        const subject = await build()

        expect(subject.campaignDraftText("Thank you from {ten_shop}.", TEMPLATE)).toBe(TEMPLATE)
    })

    it("keeps the template when an unknown placeholder appears", async () => {
        const subject = await build()

        expect(subject.campaignDraftText("{ten_khach}, redeem {coupon} at {ten_shop}.", TEMPLATE)).toBe(TEMPLATE)
    })

    it("retains an already usable plain message", async () => {
        const subject = await build()

        expect(subject.campaignDraftText("{ten_khach}, thank you for visiting.", TEMPLATE)).toBe(
            "{ten_khach}, thank you for visiting.",
        )
    })
})
