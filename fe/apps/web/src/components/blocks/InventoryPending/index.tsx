"use client"

import { useTranslations } from "next-intl"
import { useInventoryDecisions, useInventoryRun } from "@/hooks/inventory"
import { writeApproveWork, writeRejectWork } from "@/modules/db/inventory/write-inventory-decisions"
import type { PendingView } from "@/modules/types"
import { InventoryPendingBase } from "./component"

/** The decisions that wait for the owner. */
interface InventoryPendingProps {
    readonly rows: ReadonlyArray<PendingView>
}

const DECISIONS = { approveWork: writeApproveWork, rejectWork: writeRejectWork }

/** The waiting decisions: the owner approves or rejects each one here. */
export const InventoryPending = (props: InventoryPendingProps) => {
    const t = useTranslations("workbenchInventory")
    const decisions = useInventoryDecisions(DECISIONS)
    const run = useInventoryRun()
    return (
        <InventoryPendingBase
            props={{
                title: t("pendingTitle"),
                description: t("pendingHint"),
                count: props.rows.length,
                rejectLabel: t("reject"),
                rows: props.rows.map((row) => ({
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
