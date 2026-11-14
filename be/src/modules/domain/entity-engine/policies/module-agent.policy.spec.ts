import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { reachesRecords as reachesRecordsSubject } from "./module-agent.policy"

const SUBJECT = Symbol("module-agent.policy")

const build = async (): Promise<{ reachesRecords: typeof reachesRecordsSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ reachesRecords: typeof reachesRecordsSubject }>({ reachesRecords: reachesRecordsSubject }) }],
    }).compile()
    return moduleRef.get<{ reachesRecords: typeof reachesRecordsSubject }>(SUBJECT)
}

describe("reachesRecords", () => {
    let reachesRecords: typeof reachesRecordsSubject

    beforeAll(async () => {
        ;({ reachesRecords } = await build())
    })

    it("is true for a job with the multi-entity port or one entity's port", () => {
        expect(reachesRecords({ all: { id: "engine.entities" } })).toBe(true)
        expect(reachesRecords({ orders: { id: "engine.entity.sales.order" } })).toBe(true)
    })

    it("is false for a job with only the door, the workflow and the outbox", () => {
        expect(
            reachesRecords({
                door: { id: "engine.door" },
                flow: { id: "engine.workflow" },
                out: { id: "engine.outbox" },
            }),
        ).toBe(false)
        expect(reachesRecords({})).toBe(false)
    })
})
