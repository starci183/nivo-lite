"use client"

import { useInventoryBoard } from "@/hooks/inventoryBoard"
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
import { InventoryOrdersBase } from "./component"

/** The orders tab: the drawers live in their hooks, the drawing in the pure half. */
export const InventoryOrders = () => {
    const board = useInventoryBoard()
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const commands = useInventoryOrderCommands()
    const decisions = useInventoryDecisions()
    const poDrawer = usePoDrawer(board.suppliers, board.canManage, commands, decisions)
    const newPoDrawer = useNewPoDrawer(board, commands)
    const factsOf = (po: PoView): string =>
        t("orderFacts", {
            lines: po.lines.length,
            total: format.money(po.totalVnd),
            due:
                po.expectedAt !== null && isOpenPo(po.status) ? t("orderDue", { date: format.day(po.expectedAt) }) : "",
        })
    return (
        <InventoryOrdersBase
            props={{
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
            }}
            on={{
                create: newPoDrawer.open,
                open: openById(board.pos, poDrawer.open),
                poSupplier: poDrawer.on.supplier,
                poExpected: poDrawer.on.expected,
                poLine: poDrawer.on.line,
                poInvoice: poDrawer.on.invoice,
                poMessage: poDrawer.on.message,
                poSaveDraft: poDrawer.on.saveDraft,
                poSendForApproval: poDrawer.on.sendForApproval,
                poApprove: poDrawer.on.approve,
                poReject: poDrawer.on.reject,
                poReceive: poDrawer.on.receive,
                poRemind: poDrawer.on.remind,
                poCopy: poDrawer.on.copy,
                poCancel: poDrawer.on.cancel,
                poClose: poDrawer.on.close,
                newSupplier: newPoDrawer.on.supplier,
                newPick: newPoDrawer.on.pick,
                newQty: newPoDrawer.on.qty,
                newCost: newPoDrawer.on.cost,
                newAddLine: newPoDrawer.on.addLine,
                newCreate: newPoDrawer.on.create,
                newClose: newPoDrawer.on.close,
            }}
        />
    )
}
