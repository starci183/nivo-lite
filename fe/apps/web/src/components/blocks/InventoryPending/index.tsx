"use client"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
import { useTranslations } from "next-intl"
import { useInventoryDecisions, useInventoryRun } from "@/hooks/inventory"
import { InventoryPendingBase } from "./component"

/** The waiting decisions: the owner approves or rejects each one here. */
export const InventoryPending = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const decisions = useInventoryDecisions()
    const run = useInventoryRun()
    return (
        <InventoryPendingBase
            props={{
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
            }}
            on={{
                approve: (id) => run.exec(() => decisions.approve(id, null)),
                reject: (id) => run.exec(() => decisions.reject(id, t("rejectNote"))),
            }}
        />
    )
}
