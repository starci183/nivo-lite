"use client"
import { useTranslations } from "next-intl"
/** The view `usePoCopy` returns. */
export interface PoCopyView {
    readonly approveAndSend: string
    readonly close: string
    readonly poCancel: string
    readonly poCopied: string
    readonly poCopy: string
    readonly poExpected: string
    readonly poExpectedHint: string
    readonly poInvoice: string
    readonly poInvoiceHint: string
    readonly poItems: string
    readonly poMessageDrafted: string
    readonly poMessageHint: string
    readonly poQty: string
    readonly poReceive: string
    readonly poReceiveCost: string
    readonly poReceiveHint: string
    readonly poReceiveQty: string
    readonly poRemind: string
    readonly poSaveDraft: string
    readonly poSendForApproval: string
    readonly poSentEmail: string
    readonly poSupplier: string
    readonly poSupplierHint: string
    readonly poUnitCost: string
    readonly reject: string
}

/** Resolves the purchase-order drawer, supplier fields and action copy at their world owner. */
export const usePoCopy = (): PoCopyView => {
    const say = useTranslations("workbenchInventory")
    return {
        approveAndSend: say("approveAndSend"),
        close: say("close"),
        poCancel: say("poCancel"),
        poCopied: say("poCopied"),
        poCopy: say("poCopy"),
        poExpected: say("poExpected"),
        poExpectedHint: say("poExpectedHint"),
        poInvoice: say("poInvoice"),
        poInvoiceHint: say("poInvoiceHint"),
        poItems: say("poItems"),
        poMessageDrafted: say("poMessageDrafted"),
        poMessageHint: say("poMessageHint"),
        poQty: say("poQty"),
        poReceive: say("poReceive"),
        poReceiveCost: say("poReceiveCost"),
        poReceiveHint: say("poReceiveHint"),
        poReceiveQty: say("poReceiveQty"),
        poRemind: say("poRemind"),
        poSaveDraft: say("poSaveDraft"),
        poSendForApproval: say("poSendForApproval"),
        poSentEmail: say("poSentEmail"),
        poSupplier: say("poSupplier"),
        poSupplierHint: say("poSupplierHint"),
        poUnitCost: say("poUnitCost"),
        reject: say("reject"),
    } as const
}
