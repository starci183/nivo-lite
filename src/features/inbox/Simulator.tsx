"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Form, Input, NumberField, Select, SurfaceCard, Text, TextAction, Textarea } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { inbox as dict } from "@/i18n/dict/inbox"
import { governance } from "@/i18n/dict/governance"
import { simulateInbound } from "@/lib/flow-actions"
import type { WorkItem } from "@/lib/flow-types"
import { EVENT_ID_INPUT_CLASS, EVENT_ID_ROW_CLASS, FORM_GRID_CLASS, FORM_WIDE_CLASS, PRESETS_CLASS, RESULT_LINKS_CLASS, STACK_CLASS, SUBMIT_ROW_CLASS } from "./classNames"
import { CHANNELS, KINDS, formatVnd, newEventId, type FeedEvent, type SimChannel, type SimKind, type SimulatorInput } from "./model"

type Values = { channel: SimChannel; kind: SimKind; name: string; contact: string; body: string; amount: number; reference: string; items: string; eventId: string }
type Result = { readonly event: FeedEvent; readonly duplicate: boolean; readonly workItem: WorkItem | null }

const EMPTY: Omit<Values, "eventId"> = { channel: "zalo", kind: "message", name: "", contact: "", body: "", amount: Number.NaN, reference: "", items: "" }

/** Props for {@link Simulator}. */
export type SimulatorProps = { readonly initialEventId: string }

const isChannel = (v: string | null): v is SimChannel => v !== null && (CHANNELS as ReadonlyArray<string>).includes(v)
const isKind = (v: string | null): v is SimKind => v !== null && (KINDS as ReadonlyArray<string>).includes(v)

/**
 * Inbound simulator: a labelled form plus one-click presets that only fill it. One primary action sends it into NIVO.
 * Every submission carries a channel event id ("Mã sự kiện"): sending the same id again is a duplicate (a redelivery),
 * a new id is a new input even when the text is identical.
 */
export const Simulator = ({ initialEventId }: SimulatorProps) => {
  const router = useRouter()
  const t = useT(dict)
  const g = useT(governance)
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<Values>({ ...EMPTY, eventId: initialEventId })
  const [nameError, setNameError] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((prev) => ({ ...prev, [key]: value }))

  const presets: ReadonlyArray<{ id: string; label: string; values: Omit<Values, "eventId"> }> = [
    { id: "zalo", label: t("presetZalo"), values: { ...EMPTY, channel: "zalo", kind: "message", name: t("presetNameZalo"), contact: "0901234567", body: t("presetBodyZalo") } },
    { id: "o5", label: t("presetOrder5"), values: { ...EMPTY, channel: "facebook", kind: "order", name: t("presetNameFb"), contact: "0912345678", items: t("presetItems"), amount: 5_000_000, reference: "FB-5M-01" } },
    { id: "o45", label: t("presetOrder45"), values: { ...EMPTY, channel: "facebook", kind: "order", name: t("presetNameFb"), contact: "0912345678", items: t("presetItems"), amount: 45_000_000, reference: "FB-45M-01" } },
    { id: "o0", label: t("presetOrderNoAmount"), values: { ...EMPTY, channel: "facebook", kind: "order", name: t("presetNameFb"), contact: "0912345678", items: t("presetItems"), reference: "FB-NOAMT-01" } },
    { id: "bank", label: t("presetBankUnknown"), values: { ...EMPTY, channel: "bank", kind: "payment", name: t("presetBankName"), body: t("presetBankBody"), amount: 5_000_000, reference: t("presetBankRef") } },
  ]

  const onSubmit = () => {
    setFailure(null)
    if (values.name.trim().length < 2) {
      setNameError(t("errName"))
      return
    }
    setNameError(null)
    const input: SimulatorInput = {
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
      try {
        const res = await simulateInbound(input)
        if (res.ok) {
          setResult(res.data)
          router.refresh()
          timers.current.forEach(clearTimeout)
          timers.current = [setTimeout(() => router.refresh(), 3000), setTimeout(() => router.refresh(), 9000)]
        } else {
          setResult(null)
          setFailure(res.error)
        }
      } catch (e) {
        setResult(null)
        setFailure(e instanceof Error ? e.message : String(e))
      }
    })
  }

  const dept = result?.workItem ? g(`dept_${result.workItem.department}`) : null
  const waiting = result?.workItem?.status === "waiting_decision"
  const resultTitle = result
    ? result.duplicate
      ? t("resultDuplicate", { n: result.event.duplicate_count })
      : dept
        ? `${t("resultReceived")} → ${t(waiting ? "resultToWaiting" : "resultTo", { dept })}`
        : t("resultReceived")
    : ""

  return (
    <SurfaceCard label={t("simTitle")} headingLevel={2}>
      <div className={STACK_CLASS}>
        <Text size="sm" tone="muted">{t("simDesc")}</Text>
        <Text size="sm" weight="medium">{t("presetsLabel")}</Text>
        <div className={PRESETS_CLASS}>
          {presets.map((p) => (
            <Button key={p.id} variant="outline" onPress={() => { setValues({ ...p.values, eventId: newEventId() }); setNameError(null); setResult(null) }}>{p.label}</Button>
          ))}
        </div>
        <Form label={t("simTitle")} onSubmit={onSubmit} isPending={isPending}>
          <div className={FORM_GRID_CLASS}>
            <Select label={t("channel")} name="channel" options={CHANNELS.map((c) => ({ id: c, label: g(`channel_${c}`) }))} value={values.channel} isDisabled={isPending} onValueChange={(v) => { if (isChannel(v)) set("channel", v) }} />
            <Select label={t("kind")} name="kind" options={KINDS.map((k) => ({ id: k, label: g(`kind_${k}`) }))} value={values.kind} isDisabled={isPending} onValueChange={(v) => { if (isKind(v)) set("kind", v) }} />
            <Input id="sim-name" name="sender_name" label={t("senderName")} hint={t("senderNameHint")} variant="secondary" isRequired isDisabled={isPending} value={values.name} isError={Boolean(nameError)} errorMessage={nameError} onValueChange={(v) => { setNameError(null); set("name", v) }} />
            <Input id="sim-contact" name="sender_contact" label={t("contact")} variant="secondary" isDisabled={isPending} value={values.contact} onValueChange={(v) => set("contact", v)} />
            <div className={FORM_WIDE_CLASS}>
              <Textarea label={t("body")} name="body" rows={3} isDisabled={isPending} value={values.body} onValueChange={(v) => set("body", v)} />
            </div>
            {values.kind === "order" ? (
              <div className={FORM_WIDE_CLASS}>
                <Input id="sim-items" name="items" label={t("items")} variant="secondary" isDisabled={isPending} value={values.items} onValueChange={(v) => set("items", v)} />
              </div>
            ) : null}
            <NumberField label={t("amount")} name="amount" minValue={0} step={1_000_000} formatOptions={{ maximumFractionDigits: 0 }} isDisabled={isPending} value={values.amount} onValueChange={(v) => set("amount", v)} />
            <Input id="sim-ref" name="external_ref" label={t("reference")} variant="secondary" isDisabled={isPending} value={values.reference} onValueChange={(v) => set("reference", v)} />
            <div className={EVENT_ID_ROW_CLASS}>
              <div className={EVENT_ID_INPUT_CLASS}>
                <Input id="sim-event-id" name="event_id" label={t("eventId")} hint={t("eventIdHint")} variant="secondary" isDisabled={isPending} value={values.eventId} onValueChange={(v) => set("eventId", v)} />
              </div>
              <Button variant="outline" isDisabled={isPending} onPress={() => { set("eventId", newEventId()); setResult(null) }}>{t("eventIdNew")}</Button>
            </div>
            {failure ? <div className={FORM_WIDE_CLASS}><Alert title={t("failTitle")} description={failure} tone="negative" /></div> : null}
            {result ? (
              <div className={FORM_WIDE_CLASS}>
                <Alert
                  title={resultTitle}
                  tone={result.duplicate ? "cautionary" : "affirmative"}
                  description={
                    <span className={RESULT_LINKS_CLASS}>
                      {result.event.event_id ? <span>{t("eventLine", { id: result.event.event_id })}</span> : null}
                      {result.event.amount_vnd ? <span>{t("amountLine", { amount: formatVnd(result.event.amount_vnd, locale) })}</span> : null}
                      {result.event.lead_id ? <TextAction href={`/leads/${result.event.lead_id}`}>{t("resultLead")}</TextAction> : null}
                      <TextAction href="/chat">{t("resultOffice")}</TextAction>
                    </span>
                  }
                />
              </div>
            ) : null}
            <div className={SUBMIT_ROW_CLASS}>
              <Button variant="primary" type="submit" isPending={isPending}>{t("submit")}</Button>
            </div>
          </div>
        </Form>
      </div>
    </SurfaceCard>
  )
}
