"use client"

import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import { useInventoryDecisions, useInventoryRun } from "@/hooks/inventory"

/** The waiting decisions: the owner approves or rejects each one here. */
export const useInventoryPendingView = (input: InventoryPanelInput) => {
    const board = input.board
    const t = useTranslations("workbenchInventory")
    const decisions = useInventoryDecisions()
    const run = useInventoryRun(input.isActive, input.scope)
    return {
        props: {
            title: t("pendingTitle"),
            description: t("pendingHint"),
            count: board.pending.length,
            rejectLabel: t("reject"),
            rows: board.pending.map((row) => ({
                id: row.id,
                summary: row.summary,
                draft: row.draft,
                approveLabel: t(row.action === "send_purchase_order" ? "approveAndSend" : "approveAdjust"),
            })),
            isPending: run.isPending,
            error: run.error,
        },
        on: {
            onApprove: (id: string) => run.exec(() => decisions.approve(id, null)),
            onReject: (id: string) => run.exec(() => decisions.reject(id, t("rejectNote"))),
        },
    } as const
}
