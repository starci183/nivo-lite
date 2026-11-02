"use client"
import { useTranslations } from "next-intl"
/** Resolves the purchase-order drawer, supplier fields and action copy at their world owner. */
export const usePoCopy = () => {
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
