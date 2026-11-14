"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceCards } from "@/hooks/workspaces"
import { WorkspacesOverviewBase } from "./component"

/** What the workspaces page tells the overview. */
interface WorkspacesOverviewProps {
    /** The notice about why the person landed here (`disabled`); none draws nothing. */
    readonly reason?: string | undefined
}

/** The words of the reason the person landed here: a disabled seat, or no workspace at all. */
const reasonOf = (
    reason: string | undefined,
    t: (key: "reasonDisabled" | "reasonNone") => string,
): string | undefined => {
    if (reason === "disabled") return t("reasonDisabled")
    return reason === "none" ? t("reasonNone") : undefined
}

/** The connected workspaces overview: the header, the first-run welcome or the list, by what the back end GraphQL API answers. */
export const WorkspacesOverview = (props: WorkspacesOverviewProps) => {
    const t = useTranslations("onboarding")
    const { slot } = useWorkspaceCards()
    return (
        <WorkspacesOverviewBase
            shape={"isEmpty" in slot ? "welcome" : "list"}
            props={{
                createFirstLabel: t("createFirstCta"),
                createFirstNote: t("createFirstNote"),
                welcomeTitle: t("welcomeTitle"),
                welcomeText: t("welcomeText"),
                welcomeStepsLabel: t("welcomeStepsLabel"),
                welcomeSteps: [t("welcomeStep1"), t("welcomeStep2"), t("welcomeStep3"), t("welcomeStep4")],
                reason: reasonOf(props.reason, t),
            }}
        />
    )
}
