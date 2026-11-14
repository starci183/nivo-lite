"use client"

import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { tabOf, useRunsTableCopy } from "@/hooks/agentRuns"
import { useWorkflowDetail } from "@/hooks/agentWorkflowPages"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { EMPTY_STEPS_MAP } from "@/hooks/workflowSteps"
import type { PaneGridLayout, RunsTableCopy, RunsView, WorkflowDetailView } from "@/modules/types"
import { AgentWorkflowDetailBase } from "./component"
import type { AgentWorkflowDetailCopy, DetailTab } from "./parts"

/** The workflow whose page this is: its key (the old addresses carried its id, which is read the same way). */
type AgentWorkflowDetailProps = {
    readonly module?: string | undefined
    readonly installationId?: string | undefined
    readonly workflowKey?: string | undefined
    /** The part of the page the route names. */
    readonly part: DetailTab
}

const GRID: PaneGridLayout = {
    areas: { base: ["main"] },
    columns: { base: ["fill"] },
    rows: { base: ["fill"] },
}

const DETAIL_PLACEHOLDER: WorkflowDetailView = {
    head: {
        id: "-",
        name: "-",
        statusLabel: "-",
        statusTone: "neutral",
        versionLabel: "-",
        provenance: "-",
        status: "draft",
        facts: "-",
        toggleLabel: "-",
        toggleTo: "active",
        canEditGraph: false,
    },
    notice: null,
    graphTitle: "-",
    flow: EMPTY_STEPS_MAP,
    versions: [{ number: 1, title: "-", description: "-", isActive: false }],
}

const RUNS_PLACEHOLDER: RunsView = {
    workflows: [],
    rows: [],
    tabs: [],
    sources: [],
    headLine: "",
    title: "",
    isFiltered: false,
    total: 0,
}

type PageWords = ReturnType<typeof useTranslations<"agentWorkflowPages">>
type WorkflowWords = ReturnType<typeof useTranslations<"agentWorkflows">>

/** The words of the overview cards. */
const overviewCopyOf = (t: PageWords): AgentWorkflowDetailCopy["overview"] => ({
    startTitle: t("startTitle"),
    startEmpty: t("startEmpty"),
    startNote: t("triggerNote"),
    inputsTitle: t("inputsTitle"),
    inputsEmpty: t("inputsEmpty"),
    inputName: t("inputName"),
    inputRequired: t("inputRequired"),
    yes: t("yes"),
    entryLine: (entry) => t("entryLine", { entry }),
    endTitle: t("endTitle"),
    endEmpty: t("endEmpty"),
    callTitle: (target) => t("callTitle", { target }),
    callParam: t("callParam"),
    callValue: t("callValue"),
    callFrom: t("callFrom"),
})

/** The words of the page that do not come from the data. */
const copyOf = (t: PageWords, td: WorkflowWords, runs: RunsTableCopy): AgentWorkflowDetailCopy => ({
    paneLabel: t("paneLabel"),
    editMap: t("editMap"),
    addStep: t("addStep"),
    noticeAction: t("noticeAction"),
    noticePreview: t("noticePreview"),
    noticeCaption: td("noticeCaption"),
    mapTitle: t("mapTitle"),
    graphLabel: td("graphLabel"),
    graphCaption: td("graphCaption"),
    graphEmpty: td("graphEmpty"),
    overview: overviewCopyOf(t),
    versions: {
        title: t("tabVersions"),
        number: t("verNumber"),
        date: t("verDate"),
        author: t("verAuthor"),
        note: t("verNote"),
        status: t("verStatus"),
        running: t("verRunning"),
        old: t("verOld"),
        rollback: t("verRollback"),
        open: td("versionOpen"),
        confirmTitle: (number) => t("verConfirmTitle", { number }),
        confirmBody: (number) => t("verConfirmBody", { number }),
        confirm: t("verConfirm"),
        cancel: t("verCancel"),
        empty: t("versionsEmpty"),
    },
    runs,
})

/** The connected page of one workflow: reads it, its overview, its map and its runs, and draws them in four parts. */
export const AgentWorkflowDetail = (props: AgentWorkflowDetailProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentWorkflowPages")
    const td = useTranslations("agentWorkflows")
    const runsCopy = useRunsTableCopy()
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const base = navigation.usePathname().replace(/\/(map|versions|runs)$/, "")
    const page = useWorkflowDetail(route.module, route.installationId, route.workflowKey)
    const { runs } = page
    return (
        <AgentWorkflowDetailBase
            props={{
                copy: copyOf(t, td, runsCopy),
                detail: page.detail,
                placeholder: DETAIL_PLACEHOLDER,
                overview: page.overview,
                map: page.steps.map,
                drawer: page.steps.drawer,
                selectedStep: page.steps.selectedId,
                runs: runs.slot,
                runsPlaceholder: RUNS_PLACEHOLDER,
                runsFilter: runs.filter,
                versionBase: `${base}/versions`,
                part: props.part,
                grid: GRID,
                slotLabels: slotLabels(t("notFound")),
                isWriting: page.isWriting,
            }}
            on={{
                retry: page.retry,
                openMap: () => router.push(`${base}/map`),
                step: page.steps.act,
                rollback: page.rollback,
                toggle: page.setStatus,
                sync: page.sync,
                runsFilter: runs.setFilter,
                runsTab: (key) => runs.setFilter({ tab: tabOf(key) }),
                runsRetry: runs.reload,
            }}
        />
    )
}
