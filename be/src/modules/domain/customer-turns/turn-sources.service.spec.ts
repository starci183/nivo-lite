import { Test } from "@nestjs/testing"
import { TurnSourcesService } from "./turn-sources.service"

const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [TurnSourcesService] }).compile()
    return moduleRef.get(TurnSourcesService)
}

describe("TurnSourcesService", () => {
    it("keeps the knowledge of a running turn by its job and forgets it when the turn ends", async () => {
        const service = await build()
        service.keep("job-1", PRICE_LIST)
        expect(service.of("job-1")).toEqual(PRICE_LIST)
        service.drop("job-1")
        expect(service.of("job-1")).toEqual([])
    })

    it("answers no knowledge for a job it never started, and keeps the turns apart", async () => {
        const service = await build()
        service.keep("job-1", PRICE_LIST)
        expect(service.of("job-2")).toEqual([])
        service.drop("job-2")
        expect(service.of("job-1")).toEqual(PRICE_LIST)
    })
})
