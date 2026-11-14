import { Test } from "@nestjs/testing"
import { MisaAmisErrorCode } from "./errors/misa-amis.error"
import { MisaAmisClient } from "./misa-amis.client"
import { MISA_AMIS_OPERATIONS } from "./misa-amis.operations"

describe("MisaAmisClient (docs-missing)", () => {
    let client: MisaAmisClient

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ providers: [MisaAmisClient] }).compile()
        client = moduleRef.get(MisaAmisClient)
    })

    it.each([
        ["issueToken", MISA_AMIS_OPERATIONS.authToken.api],
        ["createVoucher", MISA_AMIS_OPERATIONS.voucherCreate.api],
        ["findPartner", MISA_AMIS_OPERATIONS.partnerFind.api],
    ] as const)("refuses %s as not available, naming the operation", async (method, operation) => {
        await expect(client[method]()).rejects.toMatchObject({ code: MisaAmisErrorCode.NotAvailable, params: { operation } })
    })

    it("invents no endpoint: every operation is docs-missing, with no method or path", () => {
        for (const operation of Object.values(MISA_AMIS_OPERATIONS)) {
            expect(operation).toMatchObject({ status: "docs-missing", method: null, path: null })
            expect(operation.api.startsWith("nivo.api.misa-amis.")).toBe(true)
        }
    })
})
