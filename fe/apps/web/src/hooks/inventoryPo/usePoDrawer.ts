"use client"

import {
    useDrawer,
    useInventoryFormat,
    useInventoryRun,
    useSay,
    type InventoryDecisions,
    type DrawerControl,
} from "@/hooks/inventory"
import type { InventoryCommandSet } from "@/hooks/inventoryCommands"
import type { PoView, SupplierView } from "@/modules/types"
import { useTranslations } from "next-intl"
import {
    draftInputOf,
    poDrawerProps,
    receiveInputOf,
    startPoState,
    withLine,
    type PoDrawerState,
} from "./inventoryPo.shared"

/** Opens, fills and acts on one purchase order; `props` is null while the drawer is closed. */
export const usePoDrawer = (
    suppliers: ReadonlyArray<SupplierView>,
    canManage: boolean,
    commands: InventoryCommandSet<"updatePoDraft" | "requestSend" | "cancelPo" | "receivePo">,
    decisions: InventoryDecisions,
) => {
    const t = useTranslations("workbenchInventory")
    const format = useInventoryFormat()
    const run = useInventoryRun()
    const drawer = useDrawer<PoDrawerState>()
    const { state, change, done } = drawer
    const say = useSay()
    const receivedText = (status: string, changes: ReadonlyArray<string>, accounting: boolean): string =>
        t("poReceivedDone", {
            state: t(status === "received" ? "poFull" : "poPartial"),
            changes: changes.length > 0 ? t("poPriceChanges", { list: changes.join("; ") }) : "",
            accounting: accounting ? t("poHandedToAccounting") : ".",
        })
    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            change((current) => ({ ...current, copied: true }))
        } catch {
            change((current) => ({ ...current, copied: false }))
        }
    }
    const whenOpen = (act: (open: PoDrawerState) => void) => () => {
        if (state !== null) act(state)
    }
    return {
        open: (po: PoView) => drawer.open(startPoState(po)),
        props:
            state === null
                ? null
                : poDrawerProps(state, {
                      say,
                      format,
                      suppliers,
                      canManage,
                      isPending: run.isPending,
                      error: run.error,
                      notice: run.notice,
                  }),
        on: actionsOf({
            change,
            whenOpen,
            run,
            commands,
            t,
            decisions,
            done,
            receivedText,
            copy,
            drawer,
        }),
    }
}
/** The resolved inputs for po drawer actions input. */
interface PoDrawerActionsInput {
    readonly change: (apply: (current: PoDrawerState) => PoDrawerState) => void
    readonly whenOpen: (act: (open: PoDrawerState) => void) => () => void
    readonly run: ReturnType<typeof useInventoryRun>
    readonly commands: InventoryCommandSet<"updatePoDraft" | "requestSend" | "cancelPo" | "receivePo">
    readonly t: ReturnType<typeof useTranslations<"workbenchInventory">>
    readonly decisions: InventoryDecisions
    readonly done: () => undefined
    readonly receivedText: (status: string, changes: ReadonlyArray<string>, accounting: boolean) => string
    readonly copy: (text: string) => Promise<void>
    readonly drawer: DrawerControl<PoDrawerState>
}

const actionsOf = ({
    change,
    whenOpen,
    run,
    commands,
    t,
    decisions,
    done,
    receivedText,
    copy,
    drawer,
}: PoDrawerActionsInput) => {
    return {
        supplier: (supplierId: string) => change((current) => ({ ...current, supplierId })),
        expected: (expected: string) => change((current) => ({ ...current, expected })),
        line: (index: number, field: "qty" | "cost", value: string) =>
            change((current) =>
                current.po.status === "draft"
                    ? { ...current, lines: withLine(current.lines, index, field, value) }
                    : { ...current, received: withLine(current.received, index, field, value) },
            ),
        invoice: (invoiceNo: string) => change((current) => ({ ...current, invoiceNo })),
        message: (message: string) => change((current) => ({ ...current, message })),
        saveDraft: whenOpen((open) =>
            run.exec(
                () => commands.updatePoDraft(draftInputOf(open)),
                () => t("poDraftSaved"),
            ),
        ),
        sendForApproval: whenOpen((open) =>
            run.exec(
                async () => {
                    await commands.updatePoDraft(draftInputOf(open))
                    return commands.requestSend(open.po.id, "order")
                },
                (result) => t(result.status === "done" ? "poSent" : "poSentForApproval"),
            ),
        ),
        approve: whenOpen((open) => {
            const workItemId = open.po.workItemId
            if (workItemId === null) return
            const edited = open.message.trim() === open.po.message.trim() ? null : open.message
            run.exec(() => decisions.approve(workItemId, edited), done)
        }),
        reject: whenOpen((open) => {
            const workItemId = open.po.workItemId
            if (workItemId !== null) run.exec(() => decisions.reject(workItemId, t("rejectNote")), done)
        }),
        receive: whenOpen((open) =>
            run.exec(
                () => commands.receivePo(receiveInputOf(open)),
                (result) => receivedText(result.status, result.priceChanges, result.handedToAccounting),
            ),
        ),
        remind: whenOpen((open) =>
            run.exec(
                () => commands.requestSend(open.po.id, "reminder"),
                () => t("poReminded"),
            ),
        ),
        copy: whenOpen((open) => {
            void copy(open.po.message)
        }),
        cancel: whenOpen((open) => run.exec(() => commands.cancelPo(open.po.id), done)),
        close: drawer.close,
    }
}
