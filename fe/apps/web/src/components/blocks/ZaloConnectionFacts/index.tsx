"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloHead, useZaloOverviewFacts, useZaloPage, useZaloSetupFacts } from "@/hooks/zaloConnection"
import type { DataSlot, ZaloFactView } from "@/modules/types"
import { ZaloConnectionFactsBase } from "./component"

/** What the page hands the facts: the connection of the url. */
interface ZaloConnectionFactsProps {
    readonly connectionId: string
}

/** The overview facts and the saved app keys of the OA, as one list of term and value rows. */
const joined = (
    overview: DataSlot<ReadonlyArray<ZaloFactView>>,
    setup: DataSlot<ReadonlyArray<ZaloFactView>>,
): DataSlot<ReadonlyArray<ZaloFactView>> =>
    "items" in overview && "items" in setup ? { items: [...overview.items, ...setup.items] } : overview

/**
 * The connected overview of a Zalo OA connection: the setup's four phases with the one step left while it is unfinished, and the
 * connection's facts.
 */
export const ZaloConnectionFacts = (props: ZaloConnectionFactsProps) => {
    const t = useTranslations("zaloConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const overview = useZaloOverviewFacts(props.connectionId)
    const saved = useZaloSetupFacts(props.connectionId)
    const { reload } = useZaloPage(props.connectionId)
    const { life, setup, isOwner } = useZaloHead(props.connectionId)
    const tabs = useConnectionPageTabs(undefined)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    const isWaiting = life?.id === "waiting"
    return (
        <ZaloConnectionFactsBase
            props={{
                title: tc("factsTitle"),
                facts: joined(overview, saved),
                slotLabels: slotLabels(t("factsEmpty")),
                ...(setup === null
                    ? {}
                    : {
                          setup: {
                              ...setup,
                              next: {
                                  title: isWaiting ? t("waitingTitle") : t("stepAuthorize"),
                                  body: isWaiting ? t("waitingBody") : t("stepAuthorizeHint"),
                                  ...(isOwner
                                      ? { action: { label: tc("continueSetup"), href: tabs.hrefOf("settings") } }
                                      : {}),
                              },
                          },
                      }),
            }}
            on={{ retry: reload }}
        />
    )
}
