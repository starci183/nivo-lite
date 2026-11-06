"use client"

import { useTranslations } from "next-intl"
import { useLeadCreatePane, useLeadDetailPane, useLeadListPane } from "@/hooks/leads"
import { paneGridOf, usePaneCopy } from "@/hooks/paneFrame"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { leadPath, LEADS_ROUTES, newLeadPath, workspaceHref } from "@/modules/routes"
import { LeadPanesBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the route hands the panes: the open lead (none on the list route), the search and whether the new-lead dialog is open. */
interface LeadPanesProps {
    /** The open lead; null on the list route, "" while the route loads and the lead is not known yet. */
    readonly leadId: string | null
    /** The lead the address names does not exist. */
    readonly isMissing?: boolean
    readonly query: string
    readonly isFormOpen: boolean
}

/** Reads the leads, owns the search, the stage choice, the open lead and the new-lead dialog, and draws the list beside the open lead. */
export const LeadPanes = (props: LeadPanesProps) => {
    const t = useTranslations("leads")
    const pane = usePaneCopy()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const list = useLeadListPane(props.query)
    const create = useLeadCreatePane(props.isFormOpen)
    const isOpenLead = props.leadId !== null
    const detail = useLeadDetailPane(
        props.leadId === null || props.leadId === "" ? undefined : props.leadId,
        "isLoading" in list.slot,
    )
    const isTogether = isOpenLead && detail.view.isLoading
    return (
        <LeadPanesBase
            props={{
                copy: {
                    grid: t("gridLabel"),
                    title: t("title"),
                    pageBody: t("descriptionShort"),
                    listLabel: t("listAria"),
                    detailLabel: t("detailLabel"),
                    pickTitle: t("pickTitle"),
                    pickBody: t("pickBody"),
                    missingTitle: t("notFoundTitle"),
                    missingBody: t("notFoundBody"),
                    missingBack: t("notFoundBack"),
                    newLead: t("newLead"),
                    back: pane.backToList,
                    searchLabel: t("searchLabel"),
                    searchPlaceholder: t("searchPlaceholder"),
                    clearSearch: pane.clearSearch,
                    tabsLabel: t("tabsLabel"),
                    noMatchTitle: t("noMatchTitle"),
                    noMatchBody: t("noMatchBody"),
                    clearFilters: t("clearFilters"),
                    emptyBody: t("emptyBody"),
                    errorBody: t("errorBody"),
                    loadMore: t("loadMore"),
                    retry: t("retryLoad"),
                },
                list: {
                    slot: isTogether ? { isLoading: true } : list.slot,
                    placeholder: list.placeholder,
                    labels: { ...slotLabels(t("emptyTitle")), error: t("errorTitle") },
                    query: list.query,
                    stage: list.stage,
                    selectedId: props.leadId === "" ? null : props.leadId,
                    pagination: list.pagination,
                },
                grid: paneGridOf({
                    hasList: true,
                    hasAside: props.leadId !== null && props.isMissing !== true && detail.view.isInfoOpen,
                    phone: props.leadId === null && props.isMissing !== true ? "list" : "main",
                }),
                detail: props.leadId === null || props.isMissing === true ? null : detail.view,
                isMissing: props.isMissing === true,
                create: create.props,
            }}
            on={{
                open: (leadId) => router.push(workspaceHref(workspaceId, leadPath(leadId))),
                back: () => router.push(workspaceHref(workspaceId, LEADS_ROUTES.leads)),
                newLead: () => router.push(workspaceHref(workspaceId, newLeadPath())),
                query: list.setQuery,
                stage: list.setStage,
                clear: list.clear,
                loadMore: list.loadMore,
                retry: list.retry,
                createChange: create.on.change,
                createSubmit: create.on.submit,
                createClose: create.on.close,
                ...detail.on,
            }}
        />
    )
}
