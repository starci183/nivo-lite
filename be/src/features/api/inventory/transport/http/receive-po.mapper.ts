import type { ReceivePoRequest } from "../../application/receive-po.contracts"
import type { ReceivePoOutput } from "@modules/domain/inventory"
import type { ReceivePoRequest as ReceivePoHttpRequest } from "./dto/receive-po.request"
import type { ReceivePoResponse } from "./dto/receive-po.response"

/** Maps the HTTP request to the receive-po request. */
export const toReceivePoRequest = (input: ReceivePoHttpRequest, workspaceId: string): ReceivePoRequest => ({
    workspaceId,
    input: {
        poId: input.poId,
        invoiceNo: input.invoiceNo,
        note: input.note,
        lines: input.lines.map((item) => ({ lineId: item.lineId, qty: item.qty, unitCost: item.unitCost })),
    },
})

/** Maps the receive-po result to the HTTP response. */
export const toReceivePoResponse = (result: ReceivePoOutput): ReceivePoResponse => ({
    status: result.status,
    received: result.received,
    priceChanges: [...result.priceChanges],
    payableVnd: result.payableVnd,
    handedToAccounting: result.handedToAccounting,
})
