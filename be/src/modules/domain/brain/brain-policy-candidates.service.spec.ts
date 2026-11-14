import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { BrainPolicyCandidatesService, NO_INSTALLATION } from "./brain-policy-candidates.service"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [BrainPolicyCandidatesService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(BrainPolicyCandidatesService), query: em.query }
}

describe("BrainPolicyCandidatesService", () => {
    it("pages the candidate truths: one key per truth, every fact id, the last key as the cursor", async () => {
        const { service, query } = await build()
        query.mockResolvedValue([
            { subject_key: "ship", attribute: "fee", installation: NO_INSTALLATION, id: "f1" },
            { subject_key: "ship", attribute: "fee", installation: NO_INSTALLATION, id: "f2" },
            { subject_key: "ship", attribute: "time", installation: "inst-1", id: "f3" },
        ])

        const page = await service.page(WS, null, 2)

        expect(page.keys).toEqual([
            { subjectKey: "ship", attribute: "fee", installation: NO_INSTALLATION },
            { subjectKey: "ship", attribute: "time", installation: "inst-1" },
        ])
        expect(page.factIds).toEqual(["f1", "f2", "f3"])
        expect(page.last).toEqual({ subjectKey: "ship", attribute: "time", installation: "inst-1" })
        expect(query.mock.calls[0]?.[1]).toEqual([WS, null, null, null, 2])
    })

    it("hands the cursor to the statement and answers an empty page with no last key", async () => {
        const { service, query } = await build()
        query.mockResolvedValue([])
        const after = { subjectKey: "ship", attribute: "fee", installation: NO_INSTALLATION }

        const page = await service.page(WS, after, 10)

        expect(page).toEqual({ keys: [], factIds: [], last: null })
        expect(query.mock.calls[0]?.[1]).toEqual([WS, "ship", "fee", NO_INSTALLATION, 10])
    })

    it("counts the truths never judged, and counts none when the count row is missing", async () => {
        const { service, query } = await build()
        query.mockResolvedValueOnce([{ n: 4 }])
        await expect(service.unjudged(WS)).resolves.toBe(4)
        expect(query.mock.calls[0]?.[1]).toEqual([WS])

        query.mockResolvedValueOnce([])
        await expect(service.unjudged(WS)).resolves.toBe(0)
    })

    it("asks for the proposals against some facts only when it is given facts", async () => {
        const { service, query } = await build()
        await expect(service.proposalsAgainst(WS, [])).resolves.toEqual([])
        expect(query).not.toHaveBeenCalled()

        query.mockResolvedValue([{ id: "p1" }, { id: "p2" }])
        await expect(service.proposalsAgainst(WS, ["f1"])).resolves.toEqual(["p1", "p2"])
        expect(query.mock.calls[0]?.[1]).toEqual([WS, ["f1"]])
    })

    it("lists the fact ids of some truths in some statuses, and asks nothing for an empty list of either", async () => {
        const { service, query } = await build()
        const key = { subjectKey: "ship", attribute: "fee", installation: NO_INSTALLATION }
        await expect(service.factIdsOf(WS, [], ["active"])).resolves.toEqual([])
        await expect(service.factIdsOf(WS, [key], [])).resolves.toEqual([])
        expect(query).not.toHaveBeenCalled()

        query.mockResolvedValue([{ id: "f1" }])
        await expect(service.factIdsOf(WS, [key], ["active", "scheduled"])).resolves.toEqual(["f1"])
        expect(query.mock.calls[0]?.[1]).toEqual([WS, ["ship"], ["fee"], [NO_INSTALLATION], ["active", "scheduled"]])
    })
})
