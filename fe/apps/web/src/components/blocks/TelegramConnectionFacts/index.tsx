"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useConnectionRefusal } from "@/hooks/connections"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { useSlotLabels } from "@/hooks/slot"
import {
    useTelegramHead,
    useTelegramOverviewFacts,
    useTelegramPage,
    useTelegramSetup,
} from "@/hooks/telegramConnection"
import { TelegramConnectionFactsBase } from "./component"

/** What the page hands the facts: the connection of the url. */
interface TelegramConnectionFactsProps {
    readonly connectionId: string
}

/**
 * The connected overview of a Telegram bot connection: the setup's four phases with the one step left while it is unfinished, and the
 * connection's facts.
 */
export const TelegramConnectionFacts = (props: TelegramConnectionFactsProps) => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const facts = useTelegramOverviewFacts(props.connectionId)
    const { reload } = useTelegramPage(props.connectionId)
    const { isOwner } = useTelegramHead(props.connectionId)
    const tabs = useConnectionPageTabs(undefined)
    const phases = useWizardPhases("telegram")
    const { isUnfinished, isWaiting, current, total } = useTelegramSetup(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <TelegramConnectionFactsBase
            props={{
                title: tc("factsTitle"),
                facts,
                slotLabels: slotLabels(t("factsEmpty")),
                ...(isUnfinished
                    ? {
                          setup: {
                              title: tc("setupTitle", { n: current, total }),
                              phases: phases.labels,
                              current,
                              stateLabels: phases.stateLabels,
                              next: {
                                  title: isWaiting ? t("waitingTitle") : t("setupNextTitle"),
                                  body: isWaiting ? t("waitingBody") : t("setupNextBody"),
                                  ...(isOwner
                                      ? { action: { label: tc("continueSetup"), href: tabs.hrefOf("settings") } }
                                      : {}),
                              },
                          },
                      }
                    : {}),
            }}
            on={{ retry: reload }}
        />
    )
}
