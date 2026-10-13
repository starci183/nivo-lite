import { Test } from "@nestjs/testing"
import { HIRING_OPTIONS } from "./hiring.decorators"
import { HiringLinksService } from "./hiring-links.service"

const build = async (siteUrl: string | null) => {
    const options = { siteUrl }
    const moduleRef = await Test.createTestingModule({
        providers: [HiringLinksService, { provide: HIRING_OPTIONS, useValue: options }],
    }).compile()
    return { service: moduleRef.get(HiringLinksService) }
}

describe("HiringLinksService", () => {
    it("uses the default public origin when the configured site is null", async () => {
        const { service } = await build(null)

        expect(service.job("coffee-shop", "barista")).toBe("https://nivo.vn/j/coffee-shop/barista")
        expect(service.interview("interview-token")).toBe("https://nivo.vn/j/lich/interview-token")
        expect(service.offer("offer-token")).toBe("https://nivo.vn/j/thu/offer-token")
    })

    it("uses the configured public origin for every candidate link", async () => {
        const { service } = await build("https://jobs.example.test")

        expect(service.job("shop-one", "team-lead")).toBe("https://jobs.example.test/j/shop-one/team-lead")
        expect(service.interview("choose-time")).toBe("https://jobs.example.test/j/lich/choose-time")
        expect(service.offer("answer-offer")).toBe("https://jobs.example.test/j/thu/answer-offer")
    })

    it("preserves an explicitly empty origin", async () => {
        const { service } = await build("")

        expect(service.job("shop", "cashier")).toBe("/j/shop/cashier")
        expect(service.interview("time-token")).toBe("/j/lich/time-token")
        expect(service.offer("letter-token")).toBe("/j/thu/letter-token")
    })
})
