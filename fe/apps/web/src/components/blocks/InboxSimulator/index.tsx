"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useRef, useState, useTransition } from "react"
import { simulateInbound } from "@/lib/flow-actions"
import { navigation } from "@/modules/i18n"
import { InboxSimulatorBase } from "./component"
import type { SimulatorResult, SimulatorValues } from "./component"

const { useRouter } = navigation

/** Channels the simulator can send from (website chat is real and lives in the Chatbot). */
const CHANNELS = ["zalo", "facebook", "email", "phone", "bank", "manual"] as const
/** Kinds the simulator can send. */
const KINDS = ["message", "order", "payment"] as const

type SimChannel = (typeof CHANNELS)[number]
type SimKind = (typeof KINDS)[number]

const isChannel = (value: string): value is SimChannel => CHANNELS.some((channel) => channel === value)
const isKind = (value: string): value is SimKind => KINDS.some((kind) => kind === value)

/** A fresh simulator event id. The same id sent again is a duplicate; a new id is a new input even with identical text. */
const newEventId = (): string => `sim-${crypto.randomUUID().slice(0, 8)}`

const EMPTY: Omit<SimulatorValues, "eventId"> = {
    channel: "zalo",
    kind: "message",
    name: "",
    contact: "",
    body: "",
    amount: Number.NaN,
    reference: "",
    items: "",
}

/** Props for the connected simulator. */
interface InboxSimulatorProps {
    /** The first channel event id (generated on the server so it agrees with hydration). */
    readonly initialEventId: string
}

/**
 * Inbound simulator: a labelled form plus one-click presets that only fill it. One primary action sends it into NIVO. Every submission carries a
 * channel event id: sending the same id again is a duplicate (a redelivery), a new id is a new input even when the text is identical.
 */
export const InboxSimulator = (props: InboxSimulatorProps) => {
    const t = useTranslations("inbox")
    const g = useTranslations("governance")
    const format = useFormatter()
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [values, setValues] = useState<SimulatorValues>({ ...EMPTY, eventId: props.initialEventId })
    const [nameError, setNameError] = useState<string>()
    const [failure, setFailure] = useState<string>()
    const [result, setResult] = useState<SimulatorResult>()
    const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

    useEffect(() => () => timers.current.forEach(clearTimeout), [])

    const presets: Readonly<Record<string, Omit<SimulatorValues, "eventId">>> = {
        zalo: {
            ...EMPTY,
            channel: "zalo",
            kind: "message",
            name: t("presetNameZalo"),
            contact: "0901234567",
            body: t("presetBodyZalo"),
        },
        o5: {
            ...EMPTY,
            channel: "facebook",
            kind: "order",
            name: t("presetNameFb"),
            contact: "0912345678",
            items: t("presetItems"),
            amount: 5_000_000,
            reference: "FB-5M-01",
        },
        o45: {
            ...EMPTY,
            channel: "facebook",
            kind: "order",
            name: t("presetNameFb"),
            contact: "0912345678",
            items: t("presetItems"),
            amount: 45_000_000,
            reference: "FB-45M-01",
        },
        o0: {
            ...EMPTY,
            channel: "facebook",
            kind: "order",
            name: t("presetNameFb"),
            contact: "0912345678",
            items: t("presetItems"),
            reference: "FB-NOAMT-01",
        },
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

    const change = (field: keyof SimulatorValues, value: string | number) => {
        if (field === "name") setNameError(undefined)
        setValues((previous) => ({ ...previous, [field]: value }))
    }

    const submit = () => {
        setFailure(undefined)
        if (values.name.trim().length < 2) return setNameError(t("errName"))
        setNameError(undefined)
        if (!isChannel(values.channel) || !isKind(values.kind)) return
        const input = {
            channel: values.channel,
            kind: values.kind,
            sender_name: values.name.trim(),
            sender_contact: values.contact.trim() || undefined,
            body: values.body.trim() || undefined,
            amount_vnd: Number.isFinite(values.amount) ? values.amount : null,
            external_ref: values.reference.trim() || undefined,
            items: values.items.trim() || undefined,
            event_id: values.eventId.trim() || undefined,
        }
        startTransition(async () => {
            const response = await simulateInbound(input)
            if (!response.ok) {
                setResult(undefined)
                return setFailure(response.error)
            }
            const { event, duplicate, workItem } = response.data
            const waiting = workItem?.status === "waiting_decision"
            const department = workItem === null ? null : g(`dept_${workItem.department}`)
            const title = duplicate
                ? t("resultDuplicate", { n: event.duplicate_count })
                : department === null
                  ? t("resultReceived")
                  : `${t("resultReceived")} → ${t(waiting ? "resultToWaiting" : "resultTo", { dept: department })}`
            setResult({
                title,
                tone: duplicate ? "cautionary" : "affirmative",
                lines: [
                    ...(event.event_id ? [t("eventLine", { id: event.event_id })] : []),
                    ...(event.amount_vnd
                        ? [
                              t("amountLine", {
                                  amount: format.number(event.amount_vnd, {
                                      style: "currency",
                                      currency: "VND",
                                      maximumFractionDigits: 0,
                                  }),
                              }),
                          ]
                        : []),
                ],
                leadHref: event.lead_id ? `/leads/${event.lead_id}` : null,
            })
            router.refresh()
            timers.current.forEach(clearTimeout)
            timers.current = [setTimeout(() => router.refresh(), 3000), setTimeout(() => router.refresh(), 9000)]
        })
    }

    return (
        <InboxSimulatorBase
            props={{
                title: t("simTitle"),
                description: t("simDesc"),
                presetsLabel: t("presetsLabel"),
                presets: [
                    { id: "zalo", label: t("presetZalo") },
                    { id: "o5", label: t("presetOrder5") },
                    { id: "o45", label: t("presetOrder45") },
                    { id: "o0", label: t("presetOrderNoAmount") },
                    { id: "bank", label: t("presetBankUnknown") },
                ],
                labels: {
                    channel: t("channel"),
                    kind: t("kind"),
                    name: t("senderName"),
                    nameHint: t("senderNameHint"),
                    contact: t("contact"),
                    body: t("body"),
                    items: t("items"),
                    amount: t("amount"),
                    reference: t("reference"),
                    eventId: t("eventId"),
                    eventIdHint: t("eventIdHint"),
                    eventIdNew: t("eventIdNew"),
                    submit: t("submit"),
                    failTitle: t("failTitle"),
                    resultLead: t("resultLead"),
                    resultOffice: t("resultOffice"),
                },
                channels: CHANNELS.map((channel) => ({ id: channel, label: g(`channel_${channel}`) })),
                kinds: KINDS.map((kind) => ({ id: kind, label: g(`kind_${kind}`) })),
                values,
                showItems: values.kind === "order",
                nameError,
                failure,
                result,
                isPending,
            }}
            on={{
                preset: (id) => {
                    const preset = presets[id]
                    if (preset === undefined) return
                    setValues({ ...preset, eventId: newEventId() })
                    setNameError(undefined)
                    setResult(undefined)
                },
                change,
                newEventId: () => {
                    change("eventId", newEventId())
                    setResult(undefined)
                },
                submit,
            }}
        />
    )
}
