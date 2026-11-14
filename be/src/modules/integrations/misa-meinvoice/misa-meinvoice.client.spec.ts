import { Test } from "@nestjs/testing"
import { MisaMeinvoiceErrorCode } from "./errors/misa-meinvoice.error"
import { MisaMeinvoiceClient } from "./misa-meinvoice.client"
import { MISA_MEINVOICE_OPERATIONS } from "./misa-meinvoice.operations"

describe("MisaMeinvoiceClient (docs-missing)", () => {
    let client: MisaMeinvoiceClient

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({ providers: [MisaMeinvoiceClient] }).compile()
        client = moduleRef.get(MisaMeinvoiceClient)
    })

    it.each([
        ["issueToken", MISA_MEINVOICE_OPERATIONS.authToken.api],
        ["publishInvoice", MISA_MEINVOICE_OPERATIONS.invoicePublish.api],
        ["invoiceStatus", MISA_MEINVOICE_OPERATIONS.invoiceStatusGet.api],
        ["downloadInvoice", MISA_MEINVOICE_OPERATIONS.invoiceDownload.api],
        ["cancelInvoice", MISA_MEINVOICE_OPERATIONS.invoiceCancel.api],
    ] as const)("refuses %s as not available, naming the operation", async (method, operation) => {
        await expect(client[method]()).rejects.toMatchObject({
            code: MisaMeinvoiceErrorCode.NotAvailable,
            params: { operation },
        })
    })

    it("invents no endpoint: every operation is docs-missing, with no method or path", () => {
        for (const operation of Object.values(MISA_MEINVOICE_OPERATIONS)) {
            expect(operation).toMatchObject({ status: "docs-missing", method: null, path: null })
            expect(operation.api.startsWith("nivo.api.misa-meinvoice.")).toBe(true)
            expect(operation.docs.startsWith("docs-missing:")).toBe(true)
        }
    })
})
