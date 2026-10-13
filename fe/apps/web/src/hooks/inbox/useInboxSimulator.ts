"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useInboxSimulatorForm } from "@/hooks/rhf"
import type { InboxSimulatorFormValues } from "@/hooks/rhf"
import { leadHref } from "@/modules/routes"
import { useSimulateInbound } from "./useSimulateInbound"

/** What a preset fills; the event id is always fresh. */
type PresetValues = Omit<InboxSimulatorFormValues, "eventId">

/** The simulator with nothing filled in. */
const EMPTY: PresetValues = {
    channel: "zalo",
    kind: "message",
    name: "",
    contact: "",
    body: "",
    amount: Number.NaN,
    reference: "",
    items: "",
}

/** A fresh simulator event id. The same id sent again is a duplicate; a new id is a new input even with identical text. */
const newEventId = (): string => `sim-${crypto.randomUUID().slice(0, 8)}`

/** The outcome of the last send, in words. */
interface SimulatorResultView {
    readonly title: string
    readonly tone: "affirmative" | "cautionary"
    readonly lines: ReadonlyArray<string>
    readonly leadHref: string | null
}

/** The state of the simulator form and its last send, ready for the surface that draws it. */
export const useInboxSimulator = (initialEventId: string) => {
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const format = useFormatter()
    const form = useInboxSimulatorForm(initialEventId)
    const values = form.watch()
    const { simulate, status, duplicate, isPending, failure, clearResult } = useSimulateInbound()

    const facebookOrder = (amount: number, reference: string): PresetValues => ({
        ...EMPTY,
        channel: "facebook",
        kind: "order",
        name: t("presetNameFb"),
        contact: "0912345678",
        items: t("presetItems"),
        amount,
        reference,
    })
    const presets: Readonly<Record<string, PresetValues>> = {
        zalo: {
            ...EMPTY,
            channel: "zalo",
            kind: "message",
            name: t("presetNameZalo"),
            contact: "0901234567",
            body: t("presetBodyZalo"),
        },
        o5: facebookOrder(5_000_000, "FB-5M-01"),
        o45: facebookOrder(45_000_000, "FB-45M-01"),
        o0: facebookOrder(Number.NaN, "FB-NOAMT-01"),
        bank: {
            ...EMPTY,
            channel: "bank",
            kind: "payment",
            name: t("presetBankName"),
            body: t("presetBankBody"),
            amount: 5_000_000,
            reference: t("presetBankRef"),
        },
    }

    const change = (field: keyof InboxSimulatorFormValues, value: string | number) => {
        const options = { shouldValidate: form.formState.isSubmitted }
        if (field === "amount") {
            if (typeof value === "number") form.setValue(field, value, options)
        } else if (typeof value === "string") {
            form.setValue(field, value, options)
        }
    }

    const submit = form.handleSubmit(async (input) => {
        await simulate({
            channel: input.channel,
            kind: input.kind,
            senderName: input.name,
            senderContact: input.contact || undefined,
            body: input.body || undefined,
            amountVnd: Number.isFinite(input.amount) ? input.amount : null,
            externalRef: input.reference || undefined,
            items: input.items || undefined,
            eventId: input.eventId || undefined,
        })
    })

    const resultOf = (): SimulatorResultView | undefined => {
        if (status === undefined || status.status === "failed") return undefined
        if (status.status !== "succeeded") {
            return { title: t("simulationRunning"), tone: "cautionary", lines: [], leadHref: null }
        }
        const { event, workItem } = status
        const department = workItem == null ? undefined : g(`dept_${workItem.department}`)
        const received = t("resultReceived")
        const routed = workItem?.status === "waiting_decision" ? "resultToWaiting" : "resultTo"
        const routedLine = department === undefined ? received : `${received} → ${t(routed, { dept: department })}`
        const amountLine =
            event.amountVnd == null
                ? []
                : [
                      t("amountLine", {
                          amount: format.number(event.amountVnd, {
                              style: "currency",
                              currency: "VND",
                              maximumFractionDigits: 0,
                          }),
                      }),
                  ]
        return {
            title: duplicate ? t("resultDuplicate", { n: event.duplicateCount }) : routedLine,
            tone: duplicate ? "cautionary" : "affirmative",
            lines: [...(event.eventId ? [t("eventLine", { id: event.eventId })] : []), ...amountLine],
            leadHref: event.leadId ? leadHref(event.leadId) : null,
        }
    }

    return {
        values,
        errors: {
            channel: form.formState.errors.channel?.message,
            kind: form.formState.errors.kind?.message,
            name: form.formState.errors.name?.message,
            contact: form.formState.errors.contact?.message,
            body: form.formState.errors.body?.message,
            items: form.formState.errors.items?.message,
            amount: form.formState.errors.amount?.message,
            reference: form.formState.errors.reference?.message,
            eventId: form.formState.errors.eventId?.message,
        },
        failure,
        result: resultOf(),
        isPending,
        change,
        applyPreset: (id: string) => {
            const preset = presets[id]
            if (preset === undefined) return
            form.reset({ ...preset, eventId: newEventId() })
            clearResult()
        },
        renewEventId: () => {
            change("eventId", newEventId())
            clearResult()
        },
        submit: () => void submit(),
    }
}
