import { Test } from "@nestjs/testing"
import { sequenceDateOf } from "./sequence-date.policy"

const SEQUENCE_DATE: unique symbol = Symbol("entity-engine.sequence-date")

interface SequenceDatePolicy {
    readonly sequenceDateOf: typeof sequenceDateOf
}

const build = async (): Promise<SequenceDatePolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SEQUENCE_DATE, useFactory: (): SequenceDatePolicy => ({ sequenceDateOf }) }],
    }).compile()
    return moduleRef.get<SequenceDatePolicy>(SEQUENCE_DATE)
}

describe("sequenceDateOf", () => {
    it("reads the calendar day in the workspace time zone (UTC+7)", async () => {
        const policy = await build()

        expect(policy.sequenceDateOf(new Date("2026-11-05T10:00:00.000Z"))).toEqual({ year: 2026, month: 11, day: 5 })
    })

    it("rolls into the next day after 17:00 UTC", async () => {
        const policy = await build()

        expect(policy.sequenceDateOf(new Date("2026-11-05T17:30:00.000Z"))).toEqual({ year: 2026, month: 11, day: 6 })
    })

    it("rolls into the next year at the workspace midnight", async () => {
        const policy = await build()

        expect(policy.sequenceDateOf(new Date("2026-12-31T17:00:00.000Z"))).toEqual({ year: 2027, month: 1, day: 1 })
    })
})
