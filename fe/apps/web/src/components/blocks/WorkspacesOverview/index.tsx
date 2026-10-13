"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceCards } from "@/hooks/workspaces"
import { WorkspacesOverviewBase } from "./component"

/** What the workspaces page tells the overview. */
interface WorkspacesOverviewProps {
    /** The notice about why the person landed here (`disabled`); none draws nothing. */
    readonly reason?: string
}

/** The connected workspaces overview: the header, the first-run welcome or the list, by what the back end GraphQL API answers. */
export const WorkspacesOverview = (props: WorkspacesOverviewProps) => {
    const t = useTranslations("onboarding")
    const { status, error } = useWorkspaceCards()
    return (
        <WorkspacesOverviewBase
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
                error,
                status,
                loadFailedTitle: t("loadFailed"),
            }}
        />
    )
}
