"use client"

import type { InventoryPanelInput } from "./inventoryWorkbench.shared"

import { useTranslations } from "next-intl"
import {
    PO_LANES,
    PO_TONES,
    isOpenPo,
    openById,
    useInventoryDecisions,
    useInventoryFormat,
    useNewPoDrawer,
} from "@/hooks/inventory"
import { usePoDrawer } from "@/hooks/inventoryPo"
import type { PoView } from "@/modules/types"
import { useInventoryOrderCommands } from "@/hooks/inventoryCommands"

/** The orders tab: the drawers live in their hooks, the drawing in the pure half. */
export const useInventoryOrdersView = (input: InventoryPanelInput) => {
    const board = input.board
    const lifetime = { isActive: input.isActive, scope: input.scope }
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryOrderCommands()
    const decisions = useInventoryDecisions()
    const poDrawer = usePoDrawer(board.suppliers, board.canManage, commands, decisions, lifetime)
    const newPoDrawer = useNewPoDrawer(board, commands, lifetime)
    const factsOf = (po: PoView): string =>
        t("orderFacts", {
            lines: po.lines.length,
            total: format.money(po.totalVnd),
            due:
                po.expectedAt !== null && isOpenPo(po.status) ? t("orderDue", { date: format.day(po.expectedAt) }) : "",
        })
    return {
        props: {
            createLabel: board.canManage ? t("orderCreate") : null,
            openCount: t("orderOpenCount", { n: board.metrics.openPos }),
            boardLabel: t("orderBoard"),
            emptyTitle: t("orderEmptyTitle"),
            emptyBody: t("orderEmptyBody"),
            openLabel: t("orderOpen"),
            hasOrders: board.pos.length > 0,
            lanes: PO_LANES.map((status) => {
                const cards = board.pos.filter((po) => po.status === status)
                return {
                    status,
                    label: t(`po_${status}`),
                    count: String(cards.length),
                    cards: cards.map((po) => ({
                        id: po.id,
                        poNo: po.poNo,
                        statusLabel: t(`po_${po.status}`),
                        statusTone: PO_TONES[po.status],
                        supplier: po.supplierName === "" ? t("poNoSupplier") : po.supplierName,
                        facts: factsOf(po),
                        copyNote:
                            po.status === "sent" && po.sentVia === "copy"
                                ? t("orderCopyNote", { channel: t(`channel_${po.channel ?? "email"}`) })
                                : null,
                    })),
                }
            }),
            poDrawer: poDrawer.props,
            newPoDrawer: newPoDrawer.props,
        },
        on: {
            onCreate: newPoDrawer.open,
            onOpen: openById(board.pos, poDrawer.open),
            onPoSupplier: poDrawer.on.supplier,
            onPoExpected: poDrawer.on.expected,
            onPoLine: poDrawer.on.line,
            onPoInvoice: poDrawer.on.invoice,
            onPoMessage: poDrawer.on.message,
            onPoSaveDraft: poDrawer.on.saveDraft,
            onPoSendForApproval: poDrawer.on.sendForApproval,
            onPoApprove: poDrawer.on.approve,
            onPoReject: poDrawer.on.reject,
            onPoReceive: poDrawer.on.receive,
            onPoRemind: poDrawer.on.remind,
            onPoCopy: poDrawer.on.copy,
            onPoCancel: poDrawer.on.cancel,
            onPoClose: poDrawer.on.close,
            onNewSupplier: newPoDrawer.on.supplier,
            onNewPick: newPoDrawer.on.pick,
            onNewQty: newPoDrawer.on.qty,
            onNewCost: newPoDrawer.on.cost,
            onNewAddLine: newPoDrawer.on.addLine,
            onNewCreate: newPoDrawer.on.create,
            onNewClose: newPoDrawer.on.close,
        },
    } as const
}
