"use client"

import { useTranslations } from "next-intl"
import {
    STATE_KEYS,
    WORKSPACE_ROLE_KEYS,
    canBillWorkspace,
    canOpenWorkspace,
    useOpenWorkspace,
    useWorkspaceCards,
} from "@/hooks/workspaces"
import type { WorkspaceState } from "@/hooks/workspaces"
import { workspaceBillingPath } from "@/modules/routes"
import { WorkspacesListBase } from "./component"

const STATE_TONES: Readonly<Record<WorkspaceState, "success" | "warning" | "neutral">> = {
    active: "success",
    pending: "warning",
    cancelled: "neutral",
}

/** The connected workspace list: reads the person's workspaces, opens a usable one as the current one, or leads its owner to the payment step. */
export const WorkspacesList = () => {
    const t = useTranslations("onboarding")
    const { cards, status } = useWorkspaceCards()
    const { open, openingId } = useOpenWorkspace()
    if (status !== "ready") return null
    return (
        <WorkspacesListBase
            props={{
                label: t("myWorkspaces"),
                billingLabel: t("billingLink"),
                rows: cards.map((card) => ({
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
                    const card = cards.find((candidate) => candidate.id === id)
                    if (card !== undefined) open(card)
                },
            }}
        />
    )
}
