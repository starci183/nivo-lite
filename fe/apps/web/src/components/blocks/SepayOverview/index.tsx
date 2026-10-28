"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useSepayOverviewItems } from "@/hooks/sepayConnection"
import { SepayOverviewBase } from "./component"

/** What the page hands the tab: the connection of the url. */
type SepayOverviewProps = { readonly connectionId: string }

/** The connected Overview tab: the account, the environment, the last webhook and the agents of the connection. */
export const SepayOverview = (props: SepayOverviewProps) => {
    const t = useTranslations("sepayConnection")
    const slotLabels = useSlotLabels()
    const items = useSepayOverviewItems(props.connectionId)
    return (
        <SepayOverviewBase
            props={{
                title: t("overviewTitle"),
                slot: items.slot,
                placeholder: items.placeholder,
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry: items.retry }}
        />
    )
}
