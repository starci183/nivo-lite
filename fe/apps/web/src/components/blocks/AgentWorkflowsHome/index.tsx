"use client"

import { useTranslations } from "next-intl"
import { useWorkflowsHome } from "@/hooks/agentWorkflowPages"
import { useSlotLabels } from "@/hooks/slot"
import type { PaneGridLayout, WorkflowTableRowView } from "@/modules/types"
import { AgentWorkflowsHomeBase, type AgentWorkflowsHomeCopy } from "./component"

/** The instance whose workflows the table lists. */
type AgentWorkflowsHomeProps = {
    readonly module: string
    readonly installationId: string
}

const GRID: PaneGridLayout = {
    areas: { base: ["main"] },
    columns: { base: ["fill"] },
    rows: { base: ["fill"] },
}

/** The table while its first read is under way: one row. */
const PLACEHOLDER: ReadonlyArray<WorkflowTableRowView> = [
    {
        id: "-",
        href: "",
        name: "-",
        provenance: "-",
        starts: [],
        ends: [],
        entry: "",
        versionLabel: "-",
        runs7d: null,
        statusLabel: "-",
        statusTone: "neutral",
    },
]

type PageWords = ReturnType<typeof useTranslations<"agentWorkflowPages">>
type MakerWords = ReturnType<typeof useTranslations<"agentWorkflows">>

/** The words of the tab that do not come from the data. */
const copyOf = (t: PageWords, td: MakerWords): AgentWorkflowsHomeCopy => ({
    paneLabel: t("paneLabel"),
    title: t("tableTitle"),
    create: t("create"),
    table: {
        title: t("tableTitle"),
        caption: t("listCaption"),
        name: t("colName"),
        start: t("colStart"),
        end: t("colEndCall"),
        entry: t("colEntry"),
        version: t("colVersion"),
        runs: t("colRuns"),
        status: t("colStatus"),
        none: t("none"),
        empty: t("empty"),
        emptyBody: t("emptyBody"),
    },
    drawer: {
        title: td("createTitle"),
        pick: td("createPick"),
        submit: td("createSubmit"),
        closeLabel: td("diffClose"),
        template: {
            mapTitle: td("marketMap"),
            mapLabel: td("mapLabel"),
            mapCaption: td("createPreviewCaption"),
            changelogTitle: "",
            noChanges: td("templateNoChanges"),
        },
    },
})

/**
 * The Workflows tab of an agent: the workflows as one table (what starts each, what it ends with and calls next, who may call it, its
 * version, its runs of the last week, where it stands); a row opens the page of that workflow, and "Create workflow" opens the maker.
 */
export const AgentWorkflowsHome = (props: AgentWorkflowsHomeProps) => {
    const t = useTranslations("agentWorkflowPages")
    const td = useTranslations("agentWorkflows")
    const slotLabels = useSlotLabels()
    const home = useWorkflowsHome(props.module, props.installationId)
    return (
        <AgentWorkflowsHomeBase
            props={{
                copy: copyOf(t, td),
                slot: home.slot,
                placeholder: PLACEHOLDER,
                grid: GRID,
                slotLabels: slotLabels(t("empty")),
                create: home.create.view,
                templates: home.create.templates,
            }}
            on={{
                retry: home.retry,
                createOpen: home.create.open,
                createClose: home.create.close,
                createPick: home.create.pick,
                createSubmit: home.create.submit,
            }}
        />
    )
}
