"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useOverviewPane } from "@/hooks/overviewPane"
import { paneGridOf, usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { OverviewPaneBase } from "./component"

/** Reads the dashboard once and draws the overview as panes; the open disclosures and the side drawer live here. */
export const OverviewPane = () => {
    const t = useTranslations("overview")
    const promo = useTranslations("promo")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const read = useOverviewPane()
    const [isAsideOpen, setAsideOpen] = useState(false)
    const [isSetupOpen, setSetupOpen] = useState(false)
    const [isResultsOpen, setResultsOpen] = useState(true)
    return (
        <OverviewPaneBase
            props={{
                copy: {
                    grid: t("gridLabel"),
                    main: t("mainLabel"),
                    asideTitle: t("asideTitle"),
                    asideOpen: t("asideOpen"),
                    asideClose: pane.closeAside,
                    errorBody: t("errorBody"),
                    openOffice: t("openOffice"),
                    newLead: t("newLead"),
                    setupTitle: promo("checklistTitle"),
                    setupNext: t("setupNext"),
                    setupAllSet: promo("allSet"),
                    setupProgressLabel: promo("setupProgress"),
                    toggleShow: promo("show"),
                    toggleHide: promo("hide"),
                    doneLabel: promo("done"),
                    weekTitle: t("weekTitle"),
                    workTitle: t("workTitle"),
                    workAll: t("workAll"),
                    workEmptyTitle: t("emptyMessage"),
                    departmentsTitle: t("departmentsTitle"),
                    resultsTitle: t("resultsHeading"),
                    goalSet: t("goalSet"),
                    historyAll: t("historyLink"),
                    waitingTitle: t("waitingHeading"),
                    waitingNone: t("waitingNone"),
                    seeInOffice: t("seeInOffice"),
                    exceptionsTitle: t("exceptionsTitle"),
                    exceptionsNone: t("exceptionsNone"),
                    agentsTitle: t("agents"),
                    activityTitle: t("activity"),
                    activityAll: t("activityAll"),
                },
                title: read.title,
                slot: read.slot,
                placeholder: read.placeholder,
                labels: { ...slotLabels(t("emptyMessage")), error: t("errorTitle") },
                isAsideOpen,
                isSetupOpen,
                isResultsOpen,
                grid: paneGridOf({ hasList: false, hasAside: true, phone: "main" }),
            }}
            on={{
                retry: read.retry,
                go: (href) => router.push(href),
                asideOpenChange: setAsideOpen,
                toggleSetup: () => setSetupOpen((open) => !open),
                toggleResults: () => setResultsOpen((open) => !open),
            }}
        />
    )
}
