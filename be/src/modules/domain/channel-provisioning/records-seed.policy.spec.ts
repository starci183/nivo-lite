import { Test } from "@nestjs/testing"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { readSeedRecords } from "./records-seed.policy"
import { RECORDS_SEED_SCHEMA } from "./records-seed.contracts"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const record = (overrides: Record<string, unknown> = {}) => ({
    entity: "sales.settings",
    on: "key_key",
    values: { key: "sales", maxDiscountPct: 10, autoWon: true },
    ...overrides,
})
const envelope = (...documents: ReadonlyArray<unknown>): string =>
    `${JSON.stringify({ documents: documents.map((document) => ({ path: "data/records.json", document })) })}\n`
const document = (records: unknown, overrides: Record<string, unknown> = {}) => ({
    schema: RECORDS_SEED_SCHEMA,
    records,
    ...overrides,
})

const SUBJECT = Symbol("records-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readSeedRecords } }],
    }).compile()
    return moduleRef.get<typeof import("./records-seed.policy")>(SUBJECT)
}

describe("readSeedRecords", () => {
    let policy: typeof import("./records-seed.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads the records of every document, in order", () => {
        const second = record({ entity: "chat.settings", values: { key: "chat" } })

        expect(policy.readSeedRecords(envelope(document([record()]), document([second])))).toEqual([record(), second])
    })

    it.each([
        ["a wrong schema", envelope(document([record()], { schema: "nivo/other@1" })), "schema"],
        ["no records", envelope(document([])), "records"],
        ["an entity that is not module.name", envelope(document([record({ entity: "Sales" })])), "record.entity"],
        ["a constraint name that is not a name", envelope(document([record({ on: "Key Key" })])), "record.on"],
        ["no values", envelope(document([record({ values: {} })])), "record.values"],
        [
            "a value that is not a scalar",
            envelope(document([record({ values: { key: ["sales"] } })])),
            "record.values.key",
        ],
    ])("refuses %s, by the name of the field", (_name, text, field) => {
        expect(() => policy.readSeedRecords(text)).toThrow(refused(field))
    })
})
