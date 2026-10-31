"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSlotLabels } from "@/hooks/slot"
import { useZnsRenewal } from "@/hooks/zaloConnection"
import { ZaloConnectionZnsBase } from "./component"

/** What the page hands the band: the connection of the url. */
interface ZaloConnectionZnsProps {
    readonly connectionId: string
}

/** The connected ZNS renewal template band of a Zalo OA connection, closed until opened: the owner saves the template id and its field mapping. */
export const ZaloConnectionZns = (props: ZaloConnectionZnsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const zns = useZnsRenewal(props.connectionId)
    const [isOpen, setOpen] = useState(false)
    const templateId = zns.slot.items?.templateId ?? ""
    return (
        <ZaloConnectionZnsBase
            props={{
                title: t("znsTitle"),
                hint: t("znsHint"),
                summary: templateId === "" ? t("znsOff") : t("znsOn", { id: templateId }),
                isOpen,
                slot: zns.slot,
                slotLabels: slotLabels(t("znsEmpty")),
                form: zns.form,
                labels: {
                    templateId: t("znsTemplateId"),
                    customerName: t("znsCustomerName"),
                    plan: t("znsPlan"),
                    endDate: t("znsEndDate"),
                    amount: t("znsAmount"),
                    transferContent: t("znsTransferContent"),
                    invoiceNumber: t("znsInvoiceNumber"),
                },
                saveLabel: t("znsSave"),
                note: zns.note,
                canEdit: zns.canEdit,
                isPending: zns.isSaving,
            }}
            on={{ retry: zns.reload, change: zns.change, save: () => void zns.save(), toggle: setOpen }}
        />
    )
}
