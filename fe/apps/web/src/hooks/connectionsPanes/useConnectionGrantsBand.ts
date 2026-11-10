"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import type { ConnectionGrantsView, DataSlot, SlotLabels } from "@/modules/types"
import { useConnectionGrants } from "./useConnectionGrants"

/** What the agents-of-a-connection band draws and the commands behind it, in the words of the reader. */
interface ConnectionGrantsBandRead {
    readonly props: {
        readonly title: string
        readonly assignLabel: string
        readonly emptyMessage: string
        readonly slot: DataSlot<ConnectionGrantsView>
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly remove: (agentId: string) => void
        readonly assign: (agentId: string) => void
        readonly retry: () => void
    }
}

/** The agents bound to one connection, worded for the band a connection page draws inside its agents step. */
export const useConnectionGrantsBand = (connectionId: string): ConnectionGrantsBandRead => {
    const t = useTranslations("connections")
    const labels = useSlotLabels()
    const grants = useConnectionGrants(connectionId)
    return {
        props: {
            title: t("grantsTitle"),
            assignLabel: t("grantAssign"),
            emptyMessage: t("grantsEmpty"),
            slot: grants.slot,
            labels: labels(t("grantsEmpty")),
        },
        on: { remove: grants.remove, assign: grants.assign, retry: grants.retry },
    }
}
