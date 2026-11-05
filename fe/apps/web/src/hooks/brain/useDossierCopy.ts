"use client"

import { useTranslations } from "next-intl"
import { usePaneCopy } from "@/hooks/paneFrame"

/** The words of the dossiers tab: its panes, its states and its commands. */
export interface DossierCopyWords {
    readonly grid: string
    readonly listLabel: string
    readonly viewsLabel: string
    readonly viewList: string
    readonly viewMap: string
    readonly figuresLabel: string
    readonly searchLabel: string
    readonly clearSearch: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly detailLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly back: string
    readonly moreOptions: string
    readonly openOnMap: string
    readonly closeAside: string
    readonly findingOptions: string
    readonly emptyFindings: string
    readonly filtersMore: string
    readonly mapDescription: string
    readonly assignEntry: string
}

/** Resolves the words of the dossiers tab. */
export const useDossierCopy = (): DossierCopyWords => {
    const t = useTranslations("brainDossiers")
    const brain = useTranslations("secondBrain")
    const review = useTranslations("dossierReview")
    const pane = usePaneCopy()
    return {
        grid: t("gridLabel"),
        listLabel: t("listLabel"),
        viewsLabel: t("viewsLabel"),
        viewList: t("viewList"),
        viewMap: t("viewMap"),
        figuresLabel: brain("figuresLabel"),
        searchLabel: t("searchLabel"),
        clearSearch: pane.clearSearch,
        noMatchTitle: pane.noMatchTitle,
        noMatchBody: pane.noMatchBody,
        clearFilters: pane.clearFilters,
        detailLabel: t("detailLabel"),
        pickTitle: t("pickTitle"),
        pickBody: t("pickBody"),
        emptyBody: brain("dossiersEmpty"),
        emptyAction: t("emptyAction"),
        errorBody: pane.errorBody,
        back: pane.backToList,
        moreOptions: t("moreOptions"),
        openOnMap: t("openOnMap"),
        closeAside: review("detailClose"),
        findingOptions: t("findingOptions"),
        emptyFindings: review("emptyDossier"),
        filtersMore: t("filtersMore", { count: "{count}" }),
        mapDescription: t("mapDescription"),
        assignEntry: t("assignEntry"),
    }
}
