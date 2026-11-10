"use client"

import { useTranslations } from "next-intl"
import { useConnectionPageTabs } from "@/hooks/connectionPage"
import { useWizardPhases } from "@/hooks/connection-wizard"
import { useConnectionRefusal } from "@/hooks/connections"
import { useDriveLife, useDrivePage } from "@/hooks/drive"
import { useGoogleAccount, useGoogleFacts, useGoogleServices } from "@/hooks/google"
import { useSlotLabels } from "@/hooks/slot"
import { DriveConnectionFactsBase } from "./component"

/** The grant phase of the shared four: where a workspace with no grant stands. */
const GRANT_PHASE = 2

/**
 * The connected overview of the Google account: the setup's four phases with the one step left while Drive has no grant or no first
 * sync yet, the account's services, and the connection's facts.
 */
export const DriveConnectionFacts = () => {
    const t = useTranslations("driveConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const facts = useGoogleFacts()
    const services = useGoogleServices()
    const { reload } = useDrivePage()
    const { life, phaseCount } = useDriveLife()
    const account = useGoogleAccount()
    const tabs = useConnectionPageTabs(undefined)
    const phases = useWizardPhases("drive")
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    const isUnfinished =
        life !== null && (life.id === "unconnected" || life.id === "waiting") && account.life?.id !== "running"
    const current = life?.id === "waiting" ? (life.phase ?? 3) : GRANT_PHASE
    return (
        <DriveConnectionFactsBase
            props={{
                title: tc("factsTitle"),
                servicesTitle: t("servicesTitle"),
                servicesHint: t("servicesHint"),
                services,
                facts,
                slotLabels: slotLabels(t("factsEmpty")),
                ...(isUnfinished
                    ? {
                          setup: {
                              title: tc("setupTitle", { n: current, total: phaseCount }),
                              phases: phases.labels,
                              current,
                              stateLabels: phases.stateLabels,
                              next:
                                  life.id === "waiting"
                                      ? {
                                            title: t("stepChoose"),
                                            body: t("stepChooseHint"),
                                            action: { label: tc("continueSetup"), href: tabs.hrefOf("settings") },
                                        }
                                      : { title: t("emptyTitle"), body: t("emptyBody") },
                          },
                      }
                    : {}),
            }}
            on={{ retry: reload }}
        />
    )
}
