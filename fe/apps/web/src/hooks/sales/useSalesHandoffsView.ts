"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { useSalesShipmentForm } from "@/hooks/rhf"
import type { HandoffItemView, SalesShipping, SalesWorkbenchData } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import { submitGuarded } from "@/modules/utils"
import { handoffItemsOf } from "./sales.shared"
import { useSalesActions } from "./useSalesActions"

type UseSalesHandoffsViewResult = {
    props: {
        rows: readonly HandoffItemView[]
        isBusy: boolean
        ship: {
            isOpen: boolean
            title: string
            closeLabel: string
            saveLabel: string
            cancelLabel: string
            noticeTitle: string
            noticeText: string
            carrierLabel: string
            carrierHint: string
            trackingLabel: string
            carrier: string
            tracking: string
            error: string | null
            isPending: boolean
        } | null
        label: string
        intro: string
        emptyTitle: string
        emptyBody: string
        errorLabel: string
        shipLabel: string
    }
    on: {
        run: (key: string, orderId: string) => void
        ship: (key: string) => void
        carrier: (value: string) => void
        tracking: (value: string) => void
        submit: () => void
        close: () => void
    }
}

/** Owns the original confirmed-order commands and shipping drawer while its hand-off tab is mounted. */
export const useSalesHandoffsView = (
    data: SalesWorkbenchData | null,
    isActive: boolean,
    scope: string,
): UseSalesHandoffsViewResult => {
    const t = useTranslations("workbenchSales")
    const format = useFormatter()
    const actions = useSalesActions({ isActive, scope })
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(isActive, scope)
    const rows = data?.handoffs ?? []
    const form = useSalesShipmentForm()
    const values = form.watch()
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [notes, setNotes] = useState<Readonly<Record<string, string>>>({})
    const [shipping, setShipping] = useState<SalesShipping | null>(null)
    useFeatureReset({
        isActive,
        isReady: true,
        scope,
        onReset: () => {
            setBusyKey(null)
            setNotes({})
            setShipping(null)
            form.reset({ carrier: "", tracking: "" })
        },
    })
    const submission = useShipmentSubmission({
        t,
        actions,
        form,
        shipping,
        isActive,
        scope,
        setBusyKey,
        setNotes,
        setShipping,
    })
    const isPending = submission.isPending
    const run = async (key: string, orderId: string) => {
        if (!lifetime.capture()() || actions.isMutating) return
        setNotes((previous) => ({ ...previous, [key]: "" }))
        setBusyKey(key)
        await actions.handoffToAccounting({ id: orderId })
    }
    const openShip = (key: string) => {
        const row = rows.find((candidate) => candidate.key === key)
        if (!lifetime.capture()() || row?.orderId === undefined || row.orderId === null || actions.isMutating) return
        form.reset({ carrier: "", tracking: "" })
        setShipping({ key, orderId: row.orderId, orderNo: row.orderNo, customer: row.customer })
    }
    return {
        props: {
            ...handoffLabelsOf(t),
            rows: handoffItemsOf({ t, format, rows, notes, activeKey: actions.isMutating ? busyKey : null }),
            isBusy: isPending,
            ship:
                shipping === null
                    ? null
                    : shippingDrawerOf(t, {
                          shipping,
                          values,
                          error:
                              form.formState.errors.carrier?.message ?? form.formState.errors.tracking?.message ?? null,
                          isPending,
                      }),
        },
        on: {
            run: (key: string, orderId: string): void => {
                run(key, orderId).catch((error: unknown) =>
                    runGraphQL(() => Promise.reject(error), { showSuccessToast: false }),
                )
            },
            ship: openShip,
            carrier: (value: string): void =>
                form.setValue("carrier", value, { shouldValidate: form.formState.isSubmitted }),
            tracking: (value: string): void =>
                form.setValue("tracking", value, { shouldValidate: form.formState.isSubmitted }),
            submit: submission.submit,
            close: (): void => setShipping(null),
        },
    }
}

/** Resolves the hand-off collection's six existing labels independently of its command lifecycle. */
const handoffLabelsOf = (t: ReturnType<typeof useTranslations<"workbenchSales">>) => ({
    label: t("tab_handoff"),
    intro: t("handoffIntro"),
    emptyTitle: t("handoffEmptyTitle"),
    emptyBody: t("handoffEmptyBody"),
    errorLabel: t("errorLabel"),
    shipLabel: t("shipAction"),
})

interface ShipmentSubmissionInput {
    readonly t: ReturnType<typeof useTranslations<"workbenchSales">>
    readonly actions: ReturnType<typeof useSalesActions>
    readonly form: ReturnType<typeof useSalesShipmentForm>
    readonly shipping: SalesShipping | null
    readonly isActive: boolean
    readonly scope: string
    readonly setBusyKey: Dispatch<SetStateAction<string | null>>
    readonly setNotes: Dispatch<SetStateAction<Readonly<Record<string, string>>>>
    readonly setShipping: Dispatch<SetStateAction<SalesShipping | null>>
}

interface ShipmentSubmissionFields {
    readonly carrier: string
    readonly tracking: string
}

/** Keeps RHF local validation separate from the shipment command and its originating drawer. */
const useShipmentSubmission = (input: ShipmentSubmissionInput) => {
    const { t, actions, form, shipping, scope, setBusyKey, setNotes, setShipping } = input
    const lifetime = useFeatureLifetime(input.isActive, scope)
    const runGraphQL = useGraphQLWithToast()
    const [operation, setOperation] = useState<{ scope: string; isCurrent: () => boolean } | null>(null)
    const isPending = actions.isMutating || (operation?.scope === scope && operation.isCurrent())
    const save = async (submitted: ShipmentSubmissionFields, isCurrent: () => boolean) => {
        if (shipping === null) return
        const result = await actions.markOrderShipped({
            orderId: shipping.orderId,
            carrier: submitted.carrier,
            trackingCode: submitted.tracking,
        })
        if (result === undefined || !isCurrent()) return
        setNotes((previous) => ({ ...previous, [shipping.key]: t("shipDone", { no: result.orderNo }) }))
        setShipping(null)
    }
    return {
        isPending,
        submit: () => {
            const pending = { scope, isCurrent: lifetime.capture() }
            if (!pending.isCurrent() || shipping === null || isPending) return
            setBusyKey(shipping.key)
            setOperation(pending)
            const finish = () => setOperation((current) => (current === pending ? null : current))
            submitGuarded({
                form,
                runGraphQL,
                isCurrent: pending.isCurrent,
                finish,
                save: (submitted) => save(submitted, pending.isCurrent),
            })
        },
    }
}

interface ShippingDrawerInput {
    readonly shipping: SalesShipping
    readonly values: { carrier: string; tracking: string }
    readonly error: string | null
    readonly isPending: boolean
}

/** The original controlled shipping drawer's resolved copy and field values. */
const shippingDrawerOf = (t: ReturnType<typeof useTranslations<"workbenchSales">>, input: ShippingDrawerInput) => ({
    isOpen: true,
    title: t("shipTitle"),
    closeLabel: t("cancel"),
    saveLabel: t("shipSave"),
    cancelLabel: t("cancel"),
    noticeTitle: t("shipFor", { customer: input.shipping.customer, no: input.shipping.orderNo ?? "—" }),
    noticeText: t("shipNote"),
    carrierLabel: t("shipCarrier"),
    carrierHint: t("shipCarrierHint"),
    trackingLabel: t("shipTracking"),
    carrier: input.values.carrier,
    tracking: input.values.tracking,
    error: input.error,
    isPending: input.isPending,
})
