"use client"

import { type Shipping, type SalesHandoffsControllerInput, SalesHandoffsBase, type HandoffItemView } from "./component"
import type { BadgeTone } from "@starci/grammar/common"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { useSalesShipmentForm } from "@/hooks/rhf"
import { INVOICE_TONES, useSalesActions } from "@/hooks/sales"
import { useSalesWorkbench } from "@/hooks/salesworkbench"
import { leadPath } from "@/modules/routes"
import type { HandoffRow } from "@/modules/types"

/** The tone of the invoice chip: the invoice status, else a failed or waiting hand-off. */
const invoiceToneOf = (row: HandoffRow): BadgeTone => {
    if (row.invoice) return INVOICE_TONES[row.invoice.status] ?? "neutral"
    return row.work?.status === "failed" ? "danger" : "warning"
}

/** The order whose shipping drawer is open. */

/** The hand-off surface: handing an order to Accounting and marking it shipped live here, the drawing in the pure half. */
const createSalesHandoffsState = (input: SalesHandoffsControllerInput) => {
    const { t, format, actions, rows, form, busyKey, setBusyKey, setNotes, shipping, setShipping } = input

    const shipError = form.formState.errors.carrier?.message ?? form.formState.errors.tracking?.message ?? null
    const isPending = actions.isMutating || form.formState.isSubmitting
    const activeKey = actions.isMutating ? busyKey : null

    const money = (amount: number | null): string =>
        amount === null ? "—" : format.number(amount, { style: "currency", currency: "VND", maximumFractionDigits: 0 })
    const day = (iso: string): string => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" })
    const run = async (key: string, orderId: string) => {
        if (actions.isMutating) return
        setNotes((previous) => ({ ...previous, [key]: "" }))
        setBusyKey(key)
        await actions.handoffToAccounting({ id: orderId })
    }
    const openShip = (key: string) => {
        const row = rows.find((candidate) => candidate.key === key)
        if (row?.orderId === undefined || row.orderId === null || actions.isMutating) return
        form.reset({ carrier: "", tracking: "" })
        setShipping({
            key,
            orderId: row.orderId,
            orderNo: row.orderNo,
            customer: row.customer,
        })
    }
    const submitShip = form.handleSubmit(async (submitted) => {
        if (shipping === null || actions.isMutating) return
        setBusyKey(shipping.key)
        const result = await actions.markOrderShipped({
            orderId: shipping.orderId,
            carrier: submitted.carrier,
            trackingCode: submitted.tracking,
        })
        if (result === undefined) return
        setNotes((previous) => ({ ...previous, [shipping.key]: t("shipDone", { no: result.orderNo }) }))
        setShipping(null)
    })
    return { ...input, shipError, isPending, activeKey, money, day, run, openShip, submitShip }
}

const createSalesHandoffsActions = (input: SalesHandoffsControllerInput) => {
    const context = createSalesHandoffsState(input)
    const { t, notes, activeKey, money, day } = context

    const canRunOf = (row: HandoffRow, isFailed: boolean): boolean =>
        row.orderId !== null && row.orderStatus === "confirmed" && !row.invoice && (row.canHandoff || isFailed)
    const itemOf = (row: HandoffRow): HandoffItemView => {
        const isFailed = row.work?.status === "failed" && !row.invoice
        const canRun = canRunOf(row, isFailed)
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
            error: null,
            canRun,
            runLabel: isFailed ? t("handoffRetry") : t("handoff"),
            canShip: row.canShip,
            isRunBusy: activeKey === row.key,
        }
    }
    return { ...context, itemOf }
}

/** Connects the workspace state and commands to the visual surface. */
export const SalesHandoffs = () => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const actions = useSalesActions()
    const { data } = useSalesWorkbench()
    const rows = data?.handoffs ?? []
    const form = useSalesShipmentForm()
    const values = form.watch()
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [notes, setNotes] = useState<Readonly<Record<string, string>>>({})
    const [shipping, setShipping] = useState<Shipping | null>(null)
    const context = createSalesHandoffsActions({
        t,
        format,
        actions,
        data,
        rows,
        form,
        values,
        busyKey,
        setBusyKey,
        notes,
        setNotes,
        shipping,
        setShipping,
    })

    if (data === null) return null
    return <SalesHandoffsBase {...createSalesHandoffsView(context)} />
}

const createSalesHandoffsView = (
    context: ReturnType<typeof createSalesHandoffsActions>,
): React.ComponentProps<typeof SalesHandoffsBase> => {
    const { t, rows, form, values, shipping, setShipping, shipError, isPending, run, openShip, submitShip, itemOf } =
        context
    return {
        props: {
            label: t("tab_handoff"),
            intro: t("handoffIntro"),
            emptyTitle: t("handoffEmptyTitle"),
            emptyBody: t("handoffEmptyBody"),
            errorLabel: t("errorLabel"),
            shipLabel: t("shipAction"),
            rows: rows.map(itemOf),
            isBusy: isPending,
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
                          carrier: values.carrier,
                          tracking: values.tracking,
                          error: shipError,
                          isPending,
                      },
        },
        on: {
            run: (key, orderId) => void run(key, orderId),
            ship: openShip,
            carrier: (value) => form.setValue("carrier", value, { shouldValidate: form.formState.isSubmitted }),
            tracking: (value) => form.setValue("tracking", value, { shouldValidate: form.formState.isSubmitted }),
            submit: () => void submitShip(),
            close: () => setShipping(null),
        },
    }
}
