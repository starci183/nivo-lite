import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { MisaMeinvoiceClient } from "@modules/integrations/misa-meinvoice"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { MisaMeinvoiceInvoiceService, misaMeinvoiceFailureOf } from "./misa-meinvoice-invoice.service"

const ACCOUNT = connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider: "misa_meinvoice", meta: {} })

describe("MisaMeinvoiceInvoiceService (docs-missing)", () => {
    it("is the issue port of the provider key the connector catalogue lists", () => {
        expect(new MisaMeinvoiceInvoiceService(new MisaMeinvoiceClient()).provider).toBe("misa_meinvoice")
    })

    it("refuses an issue as not available, proved not_sent, naming the operation", async () => {
        const service = new MisaMeinvoiceInvoiceService(new MisaMeinvoiceClient())

        const thrown: unknown = await service.issue(ACCOUNT, { draftId: "d-1", renewalId: null }).catch((cause: unknown) => cause)

        expect(thrown).toMatchObject({
            code: ProviderRegistryErrorCode.RefusedNotAvailable,
            params: { detail: "nivo.api.misa-meinvoice.invoice.publish" },
        })
        expect(proofOf(thrown)).toBe("not_sent")
    })

    it("leaves any other failure as it is", () => {
        const cause = new Error("other")
        expect(misaMeinvoiceFailureOf(cause)).toBe(cause)
    })
})
