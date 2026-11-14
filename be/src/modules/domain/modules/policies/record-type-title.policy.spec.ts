import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { recordTypeTitleOf as recordTypeTitleOfSubject } from "./record-type-title.policy"

const SUBJECT = Symbol("record-type-title.policy")

describe("record-type-title.policy built the way Nest does", () => {
    let recordTypeTitleOf: typeof recordTypeTitleOfSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ recordTypeTitleOf: typeof recordTypeTitleOfSubject }>({ recordTypeTitleOf: recordTypeTitleOfSubject }) }],
        }).compile()
        ;({ recordTypeTitleOf } = moduleRef.get<{ recordTypeTitleOf: typeof recordTypeTitleOfSubject }>(SUBJECT))
    })

describe("recordTypeTitleOf", () => {
    it("names a record type by its domain part: capitalised, dashes as blanks", () => {
        expect(recordTypeTitleOf("blocks-core.chatbot.message")).toBe("Message")
        expect(recordTypeTitleOf("blocks-core.sales.order-line")).toBe("Order line")
        expect(recordTypeTitleOf("nivo-web-core.webbooks.invoice")).toBe("Invoice")
    })

    it("reads an old-form two-part name by its last part", () => {
        expect(recordTypeTitleOf("sales.member")).toBe("Member")
    })

    it("keeps a name with no dot as it is", () => {
        expect(recordTypeTitleOf("thing")).toBe("Thing")
    })
})
})
