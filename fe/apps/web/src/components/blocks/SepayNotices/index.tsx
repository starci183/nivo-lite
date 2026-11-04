"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal, wizardQuery } from "@/hooks/connections"
import { useSepayConnection } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SepayNoticesBase } from "./component"

/** What the page hands the notices: the connection of the url and the Connections page the reconnect leads to. */
type SepayNoticesProps = {
    readonly connectionId: string
    readonly hubHref: string
}

/** The connected notices of a SePay page: a failed read, the last failed delivery, and the way back from a disconnected connection. */
export const SepayNotices = (props: SepayNoticesProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const refusal = useConnectionRefusal()
    const connection = "items" in slot ? slot.items : undefined
    return (
        <SepayNoticesBase
            props={{
                slot: mapSlot(slot, (items) => ({ lastError: items.lastError ?? "" })),
                labels: slotLabels(t("loadFailed")),
                errorTitle: t("lastErrorTitle"),
                ...(refusal === undefined ? {} : { refusal }),
                ...(connection?.status === "disconnected"
                    ? {
                          reconnect: {
                              title: t("disconnectedTitle"),
                              description: t("disconnectedBody"),
                              label: t("reconnect"),
                              href: `${props.hubHref}?${wizardQuery("sepay")}`,
                          },
                      }
                    : {}),
            }}
            on={{ retry }}
        />
    )
}
