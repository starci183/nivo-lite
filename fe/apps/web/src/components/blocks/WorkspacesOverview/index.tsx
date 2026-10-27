"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkspaceCards } from "@/hooks/workspaces"
import type { DataSlot } from "@/modules/types"
import { WorkspacesOverviewBase } from "./component"
import type { WorkspacesCount } from "./component"

/** What the workspaces page tells the overview. */
interface WorkspacesOverviewProps {
    /** The notice about why the person landed here (`disabled`); none draws nothing. */
    readonly reason?: string | undefined
}

/** The connected workspaces overview: the header, the first-run welcome or the list, by what the back end GraphQL API answers. */
export const WorkspacesOverview = (props: WorkspacesOverviewProps) => {
    const t = useTranslations("onboarding")
    const slotLabels = useSlotLabels()
    const { cards, status, reload } = useWorkspaceCards()
    const slot: DataSlot<WorkspacesCount> = {
        isLoading: status === "loading",
        isError: status === "error",
        items: status === "empty" || status === "ready" ? { count: cards.length } : undefined,
    }
    return (
        <WorkspacesOverviewBase
            shape={status === "empty" ? "welcome" : "list"}
            props={{
                title: t("workspacesTitle"),
                description: t("workspacesText"),
                createLabel: t("createNew"),
                createFirstLabel: t("createFirst"),
                welcomeTitle: t("welcomeTitle"),
                welcomeText: t("welcomeText"),
                welcomeStepsLabel: t("welcomeStepsLabel"),
                welcomeSteps: [t("welcomeStep1"), t("welcomeStep2"), t("welcomeStep3")],
                reason: props.reason === "disabled" ? t("reasonDisabled") : undefined,
                canCreate: status === "ready",
                slot,
                slotLabels: slotLabels(t("welcomeTitle")),
            }}
            on={{ retry: reload }}
        />
    )
}
