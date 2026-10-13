"use client"

import { useTranslations } from "next-intl"
import {
    STATE_KEYS,
    WORKSPACE_ROLE_KEYS,
    canBillWorkspace,
    canOpenWorkspace,
    useOpenWorkspace,
} from "@/hooks/workspaces"
import type { WorkspaceCardView, WorkspaceState } from "@/hooks/workspaces"
import { writeSwitchWorkspace } from "@/modules/db/shell/write-switch-workspace"
import { workspaceBillingPath } from "@/modules/routes"
import { WorkspacesListBase } from "./component"

/** Props for the connected workspace list. */
interface WorkspacesListProps {
    readonly workspaces: ReadonlyArray<WorkspaceCardView>
}

const STATE_TONES: Readonly<Record<WorkspaceState, "success" | "warning" | "neutral">> = {
    active: "success",
    pending: "warning",
    cancelled: "neutral",
}

/** The connected workspace list: opens a usable workspace as the current one, or leads its owner to the payment step. */
export const WorkspacesList = (props: WorkspacesListProps) => {
    const t = useTranslations("onboarding")
    const { open, openingId } = useOpenWorkspace(writeSwitchWorkspace)
    return (
        <WorkspacesListBase
            props={{
                label: t("myWorkspaces"),
                billingLabel: t("billingLink"),
                rows: props.workspaces.map((card) => ({
                    id: card.id,
                    name: card.name,
                    roleLabel: t(WORKSPACE_ROLE_KEYS[card.role]),
                    stateLabel: t(STATE_KEYS[card.state]),
                    stateTone: STATE_TONES[card.state],
                    actionLabel: card.state === "active" ? t("open") : t("payNow"),
                    canOpen: canOpenWorkspace(card),
                    isPrimary: card.state !== "active",
                    isOpening: openingId === card.id,
                    billingHref: canBillWorkspace(card) ? workspaceBillingPath(card.id) : undefined,
                })),
            }}
            on={{
                open: (id) => {
                    const card = props.workspaces.find((candidate) => candidate.id === id)
                    if (card !== undefined) open(card)
                },
            }}
        />
    )
}
