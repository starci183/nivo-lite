import { Test } from "@nestjs/testing"
import { NO_RECORDS, statedRecordsOf } from "./call-records.policy"

const envelope = (data: unknown, extra: Readonly<Record<string, unknown>> = {}) => ({
    ok: true,
    status: 200,
    data,
    truncated: false,
    omitted: 0,
    ...extra,
})

const SUBJECT = Symbol("call-records.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { statedRecordsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./call-records.policy")>(SUBJECT)
}

describe("statedRecordsOf: the records a call touched, as its adapter stated them", () => {
    it("counts a page read as its entries plus the ones the answer omitted", async () => {
        const subject = await build()

        expect(subject.statedRecordsOf("read", envelope({ items: [{ id: 1 }, { id: 2 }], nextCursor: null }))).toEqual({
            read: 2,
            changed: null,
        })
        expect(subject.statedRecordsOf("read", envelope({ items: [{ id: 1 }] }, { omitted: 13, truncated: true }))).toEqual({
            read: 14,
            changed: null,
        })
    })

    it("counts one record as 1, and a bare list as its entries", async () => {
        const subject = await build()

        expect(subject.statedRecordsOf("read", envelope({ id: "c-1", name: "Minh An" }))).toEqual({ read: 1, changed: null })
        expect(subject.statedRecordsOf("read", envelope([{ id: 1 }, { id: 2 }, { id: 3 }]))).toEqual({ read: 3, changed: null })
    })

    it("counts a write the envelope answered as one record changed", async () => {
        const subject = await build()

        expect(subject.statedRecordsOf("write", envelope({ id: "c-1" }, { status: 201 }))).toEqual({ read: null, changed: 1 })
        expect(subject.statedRecordsOf("restricted", envelope(null, { status: 204 }))).toEqual({ read: null, changed: 1 })
    })

    it("states nothing for a read with no data, a refusal of the outside system, or any answer outside the envelope", async () => {
        const subject = await build()

        expect(subject.statedRecordsOf("read", envelope(null))).toEqual(NO_RECORDS)
        expect(subject.statedRecordsOf("write", { ok: false, status: 409, refusal: "conflict" })).toEqual(NO_RECORDS)
        expect(subject.statedRecordsOf("write", envelope({ id: 1 }, { status: 409 }))).toEqual(NO_RECORDS)
        expect(subject.statedRecordsOf("read", { facts: [{ id: "f1", v: 2 }] })).toEqual(NO_RECORDS)
        expect(subject.statedRecordsOf("write", { kind: "appended", id: "e-1" })).toEqual(NO_RECORDS)
    })
})
