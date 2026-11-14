import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OrderCodesPolicy as OrderCodesPolicySubject } from "./payos-order-code.policy"

const SUBJECT = Symbol("payos-order-code.policy")

describe("payos-order-code.policy built the way Nest does", () => {
    let OrderCodesPolicy: typeof OrderCodesPolicySubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ OrderCodesPolicy: typeof OrderCodesPolicySubject }>({ OrderCodesPolicy: OrderCodesPolicySubject }) }],
        }).compile()
        ;({ OrderCodesPolicy } = moduleRef.get<{ OrderCodesPolicy: typeof OrderCodesPolicySubject }>(SUBJECT))
    })

describe("OrderCodesPolicy (payOS orderCode: the docs state an integer and nothing more, https://payos.vn/docs/api/)", () => {
    it("is the time in milliseconds, a safe integer", () => {
        const codes = new OrderCodesPolicy()

        const code = codes.next(1789000000123)

        expect(code).toBe(1789000000123)
        expect(Number.isSafeInteger(code)).toBe(true)
    })

    it("is strictly increasing, so two links made in the same millisecond (or after a clock step back) never share a code", () => {
        const codes = new OrderCodesPolicy()

        expect([codes.next(1000), codes.next(1000), codes.next(999), codes.next(1005)]).toEqual([1000, 1001, 1002, 1005])
    })
})
})
