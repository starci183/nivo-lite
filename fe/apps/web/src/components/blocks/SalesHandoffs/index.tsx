"use client"

import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { INVOICE_TONES } from "@/hooks/sales"
import { useBusyRow } from "@/hooks/workbench"
import { writeHandoffToAccounting, writeMarkShipped } from "@/modules/db/sales/write-sales-actions"
import { leadPath } from "@/modules/routes"
import type { HandoffRow } from "@/modules/types"
import { SalesHandoffsBase } from "./component"
import type { HandoffItemView } from "./component"

/** The tone of the invoice chip: the invoice status, else a failed or waiting hand-off. */
const invoiceToneOf = (row: HandoffRow): BadgeTone => {
    if (row.invoice) return INVOICE_TONES[row.invoice.status] ?? "neutral"
    return row.work?.status === "failed" ? "danger" : "warning"
}

/** The orders and won deals of the hand-off surface. */
interface SalesHandoffsProps {
    readonly rows: ReadonlyArray<HandoffRow>
}

/** What a refused or failed command answers: its kind and, when the service was unavailable, a code. */
interface FailedResult {
    readonly kind: string
    readonly code?: string
}

/** The order whose shipping drawer is open and what a person has typed into it. */
interface Shipping {
    readonly key: string
    readonly orderId: string
    readonly orderNo: string | null
    readonly customer: string
    readonly carrier: string
    readonly tracking: string
}

/** The hand-off surface: handing an order to Accounting and marking it shipped live here, the drawing in the pure half. */
export const SalesHandoffs = (props: SalesHandoffsProps) => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const { router, isPending, startTransition, busyKey, setBusyKey, errors, setErrors } = useBusyRow()
    const [notes, setNotes] = useState<Readonly<Record<string, string>>>({})
    const [shipping, setShipping] = useState<Shipping | null>(null)
    const [shipError, setShipError] = useState<string | null>(null)
    const activeKey = isPending ? busyKey : null

    const money = (amount: number | null): string =>
        amount === null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const day = (iso: string): string => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })
    const failure = (result: FailedResult): string =>
        t("actionFailed", { error: result.kind === "unavailable" ? (result.code ?? result.kind) : result.kind })
    const run = (key: string, orderId: string) => {
        setErrors((previous) => ({ ...previous, [key]: "" }))
        setNotes((previous) => ({ ...previous, [key]: "" }))
        setBusyKey(key)
        startTransition(async () => {
            const result = await writeHandoffToAccounting(orderId)
            if (result.kind === "ok") {
                setNotes((previous) => ({ ...previous, [key]: t(`handoffResult_${result.value.status}`) }))
                router.refresh()
            } else setErrors((previous) => ({ ...previous, [key]: failure(result) }))
            setBusyKey(null)
        })
    }
    const openShip = (key: string) => {
        const row = props.rows.find((candidate) => candidate.key === key)
        if (row === undefined || row.orderId === null) return
        setShipError(null)
        setShipping({
            key,
            orderId: row.orderId,
            orderNo: row.orderNo,
            customer: row.customer,
            carrier: "",
            tracking: "",
        })
    }
    const submitShip = () => {
        if (shipping === null) return
        setShipError(null)
        startTransition(async () => {
            const result = await writeMarkShipped({
                orderId: shipping.orderId,
                carrier: shipping.carrier,
                trackingCode: shipping.tracking,
            })
            if (result.kind !== "ok") {
                setShipError(failure(result))
                return
            }
            setNotes((previous) => ({ ...previous, [shipping.key]: t("shipDone", { no: result.value.orderNo }) }))
            setShipping(null)
            router.refresh()
        })
    }

    const itemOf = (row: HandoffRow): HandoffItemView => {
        const isFailed = row.work?.status === "failed" && !row.invoice
        const canRun =
            row.orderId !== null && row.orderStatus === "confirmed" && !row.invoice && (row.canHandoff || isFailed)
        return {
            key: row.key,
            orderId: row.orderId,
            orderLabel: t(`order_${row.orderStatus}`),
            orderTone: row.orderStatus === "won_without_order" ? "neutral" : "success",
            invoiceLabel: row.invoice ? t(`invoice_${row.invoice.status}`) : t("invoiceNone"),
            invoiceTone: invoiceToneOf(row),
            confirmed: row.confirmedAt ? day(row.confirmedAt) : null,
            customer: row.customer,
            leadHref: row.leadId === null ? null : leadPath(row.leadId),
            detail: [row.orderNo, row.items].filter(Boolean).join(" · "),
            amount: money(row.invoice?.amountVnd ?? row.amountVnd),
            invoiceLine: row.invoice ? t("invoiceLine", { no: row.invoice.no }) : null,
            shippedLine: row.shippedAt
                ? t("shippedLine", {
                      carrier: row.carrier ?? "—",
                      code: row.trackingCode ?? "—",
                      date: day(row.shippedAt),
                  })
                : null,
            workText: row.work && !row.invoice ? t(`work_${row.work.status}`) : null,
            errorText: isFailed && row.work?.error ? row.work.error : null,
            hint: row.orderStatus === "won_without_order" && !row.work ? t("wonNoOrderHint") : null,
            note: notes[row.key] ? notes[row.key] : null,
            error: errors[row.key] ? errors[row.key] : null,
            canRun,
            runLabel: isFailed ? t("handoffRetry") : t("handoff"),
            canShip: row.canShip,
            isRunBusy: activeKey === row.key,
        }
    }

    return (
        <SalesHandoffsBase
            props={{
                label: t("tab_handoff"),
                intro: t("handoffIntro"),
                emptyTitle: t("handoffEmptyTitle"),
                emptyBody: t("handoffEmptyBody"),
                errorLabel: t("errorLabel"),
                shipLabel: t("shipAction"),
                rows: props.rows.map(itemOf),
                isBusy: activeKey !== null,
                ship:
                    shipping === null
                        ? null
                        : {
                              isOpen: true,
                              title: t("shipTitle"),
                              closeLabel: t("cancel"),
                              saveLabel: t("shipSave"),
                              cancelLabel: t("cancel"),
                              noticeTitle: t("shipFor", { customer: shipping.customer, no: shipping.orderNo ?? "—" }),
                              noticeText: t("shipNote"),
                              carrierLabel: t("shipCarrier"),
                              carrierHint: t("shipCarrierHint"),
                              trackingLabel: t("shipTracking"),
                              carrier: shipping.carrier,
                              tracking: shipping.tracking,
                              error: shipError,
                              isPending,
                          },
            }}
            on={{
                run,
                ship: openShip,
                carrier: (value) =>
                    setShipping((previous) => (previous === null ? null : { ...previous, carrier: value })),
                tracking: (value) =>
                    setShipping((previous) => (previous === null ? null : { ...previous, tracking: value })),
                submit: submitShip,
                close: () => setShipping(null),
            }}
        />
    )
}
