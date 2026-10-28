"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceCards } from "@/hooks/workspaces"
import { WorkspacesCreateBase } from "./component"

/** The connected create action of the workspaces page header: offered once the person has workspaces. */
export const WorkspacesCreate = () => {
    const t = useTranslations("onboarding")
    const { status } = useWorkspaceCards()
    return status === "ready" ? <WorkspacesCreateBase props={{ label: t("createNew") }} /> : null
}
