import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { HubCardPayload } from "./accounting-desk.contracts"
import { AccountingRoomService } from "./accounting-room.service"
import { ACCOUNTING_GATEWAY } from "./accounting-gateway.decorators"
import type { AccountingGateway, FolioSnapshot, OptionalFolio } from "./accounting-gateway.port"
import { FolioReconcileService } from "./folio-reconcile.service"

const WS = "ws-1"

const FOLIO: FolioSnapshot = {
    folioId: "f-1",
    stayId: "s-1",
    guestName: "Lan",
    roomNumber: "302",
    balanceVnd: 12_800_000,
    paidVnd: 0,
    transferRef: "HAKUEN F7K2Q9",
}

const CARD: HubCardPayload = { v: 1, type: "exception", title: "x" }

const build = async (folio: OptionalFolio, recorded = true) => {
    const gateway = mock<AccountingGateway>({
        findByTransferRef: jest.fn(() => Promise.resolve(folio)),
        recordPayment: jest.fn(() => Promise.resolve(recorded)),
    })
    const room = mock<AccountingRoomService>({
        post: jest.fn(() => Promise.resolve()),
        postCard: jest.fn(() => Promise.resolve(CARD)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            FolioReconcileService,
            { provide: ACCOUNTING_GATEWAY, useValue: gateway },
            { provide: AccountingRoomService, useValue: room },
        ],
    }).compile()
    return { service: moduleRef.get(FolioReconcileService), gateway, room }
}

const credit = (amountVnd: number, content = "CK HAKUEN F7K2Q9 phong 302") => ({
    bankTxnRef: "SP-1",
    content,
    amountVnd,
})

describe("FolioReconcileService", () => {
    it("records an exact payment of the balance on the folio and reports it", async () => {
        const { service, gateway, room } = await build(FOLIO)

        await expect(service.reconcile(WS, credit(12_800_000))).resolves.toEqual({ kind: "recorded" })
        expect(gateway.findByTransferRef).toHaveBeenCalledWith(WS, "HAKUEN F7K2Q9")
        expect(gateway.recordPayment).toHaveBeenCalledWith(WS, {
            folioId: "f-1",
            bankTxnRef: "SP-1",
            amountVnd: 12_800_000,
        })
        expect(room.post).toHaveBeenCalledWith(WS, expect.stringContaining("302 (Lan)"))
    })

    it("reports a payment HAKUEN did not record", async () => {
        const { service, room } = await build(FOLIO, false)

        await expect(service.reconcile(WS, credit(12_800_000))).resolves.toEqual({ kind: "record_failed" })
        expect(room.post).toHaveBeenCalledWith(WS, expect.stringContaining("SP-1"))
    })

    it("raises a different amount as an exception card and records nothing", async () => {
        const { service, gateway, room } = await build(FOLIO)

        await expect(service.reconcile(WS, credit(5_000_000))).resolves.toEqual({ kind: "mismatch", match: "partial" })
        expect(gateway.recordPayment).not.toHaveBeenCalled()
        expect(room.postCard).toHaveBeenCalledWith(
            WS,
            expect.objectContaining({
                type: "exception",
                data: expect.objectContaining({ folioId: "f-1", stayId: "s-1", bankTxnRef: "SP-1" }),
            }),
            expect.stringContaining("302"),
        )
    })

    it("leaves credits without a folio memo or with an unknown memo alone", async () => {
        const known = await build(FOLIO)
        await expect(known.service.reconcile(WS, credit(1, "chuyen tien"))).resolves.toEqual({ kind: "no_code" })
        expect(known.gateway.findByTransferRef).not.toHaveBeenCalled()
        const unknown = await build(null)
        await expect(unknown.service.reconcile(WS, credit(1))).resolves.toEqual({ kind: "unknown_folio" })
    })
})
