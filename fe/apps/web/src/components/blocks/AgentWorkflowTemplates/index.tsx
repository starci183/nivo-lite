"use client"

import { useTranslations } from "next-intl"
import { useWorkflowTemplates } from "@/hooks/agentWorkflows"
import { useSlotLabels } from "@/hooks/slot"
import type { WorkflowTemplateRowView } from "@/modules/types"
import { AgentWorkflowTemplatesBase } from "./component"

/** The list while its first read is under way: one row. */
const PLACEHOLDER: ReadonlyArray<WorkflowTemplateRowView> = [
    { id: "-", name: "-", summary: "-", meta: "-", role: "-", source: "", needs: "", latest: 1 },
]

/** The connected workflow templates of the market: reads them all, and opens one with its map and its changelog. */
export const AgentWorkflowTemplates = () => {
    const t = useTranslations("agentWorkflows")
    const slotLabels = useSlotLabels()
    const templates = useWorkflowTemplates()
    return (
        <AgentWorkflowTemplatesBase
            props={{
                title: t("marketTitle"),
                empty: t("marketEmpty"),
                close: t("marketClose"),
                template: {
                    mapTitle: t("marketMap"),
                    mapLabel: t("mapLabel"),
                    mapCaption: t("graphCaption"),
                    changelogTitle: t("marketChangelog"),
                    noChanges: t("templateNoChanges"),
                },
                slot: templates.slot,
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("marketEmpty")),
                detail: templates.detail,
            }}
            on={{ open: templates.open, close: templates.close, retry: templates.reload }}
        />
    )
}
