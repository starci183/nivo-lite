"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayConnection, useSepayLiveSwitch } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { SepayNoticesBase } from "./component"

/** What the page hands the notices: the connection of the url. */
type SepayNoticesProps = {
    readonly connectionId: string
}

/** The connected notices of a SePay page: a failed read, the last failed delivery, the offer of real money, and a disconnected connection. */
export const SepayNotices = (props: SepayNoticesProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const liveSwitch = useSepayLiveSwitch(props.connectionId)
    const refusal = useConnectionRefusal()
    const connection = "items" in slot ? slot.items : undefined
    return (
        <SepayNoticesBase
            props={{
                slot: mapSlot(slot, (items) => ({ lastError: items.lastError ?? "" })),
                labels: slotLabels(t("loadFailed")),
                errorTitle: t("lastErrorTitle"),
                ...(refusal === undefined ? {} : { refusal }),
                ...(liveSwitch.isOffered
                    ? {
                          live: {
                              title: t("liveOfferTitle"),
                              description: t("liveOfferBody"),
                              label: t("liveConfirmAction"),
                          },
                      }
                    : {}),
                confirm: {
                    isOpen: liveSwitch.isAsking,
                    title: t("liveConfirmTitle"),
                    description: t("liveConfirmBody", { account: liveSwitch.accountMasked }),
                    confirmLabel: t("liveConfirmAction"),
                    cancelLabel: t("cancel"),
                    isPending: liveSwitch.isPending,
                },
                ...(connection?.status === "disconnected"
                    ? { disconnected: { title: t("disconnectedTitle"), description: t("disconnectedBody") } }
                    : {}),
            }}
            on={{ retry, askLive: liveSwitch.ask, confirmLive: liveSwitch.confirm, dismiss: liveSwitch.dismiss }}
        />
    )
}
