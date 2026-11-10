"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSepayConnection, useSepayFacts, useSepayHead, useSepaySetup } from "@/hooks/sepayConnection"
import { useSlotLabels } from "@/hooks/slot"
import { SepayHealthBase } from "./component"

/** What the page hands the overview: the connection of the url. */
type SepayHealthProps = { readonly connectionId: string }

/**
 * The connected overview of a SePay connection: the setup's four phases with the one step left while it is unfinished, and the
 * connection's details.
 */
export const SepayHealth = (props: SepayHealthProps) => {
    const t = useTranslations("sepayConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const facts = useSepayFacts(props.connectionId)
    const { retry } = useSepayConnection(props.connectionId)
    const { isOwner } = useSepayHead(props.connectionId)
    const setup = useSepaySetup(props.connectionId)
    const tabs = useConnectionPageTabs(undefined)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <SepayHealthBase
            props={{
                title: tc("factsTitle"),
                facts,
                slotLabels: slotLabels(t("loadFailed")),
                ...(setup === undefined
                    ? {}
                    : {
                          setup: {
                              ...setup,
                              next: {
                                  ...setup.next,
                                  ...(isOwner
                                      ? { action: { label: tc("continueSetup"), href: tabs.hrefOf("settings") } }
                                      : {}),
                              },
                          },
                      }),
            }}
            on={{ retry }}
        />
    )
}
