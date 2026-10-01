"use client"

import { useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Alert, Button, Input, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import type { Connection, Provider } from "@/lib/channels"
import { connectSepay, connectTelegram, connectZalo } from "@/lib/connection-actions"
import type { Outcome } from "@/lib/types"
import { ACTIONS_CLASS, FORM_GRID_CLASS, FULL_BOX_CLASS, HEAD_CLASS, STACK_CLASS, STEPS_CLASS } from "./classNames"
import { ConnectionRow } from "./ConnectionRow"
import { CopyField } from "./CopyField"

/** Props for {@link ProviderSection}. */
export type ProviderSectionProps = {
  readonly provider: Provider
  readonly items: ReadonlyArray<Connection>
  readonly agentNames: Readonly<Record<string, string>>
  readonly localOnly: boolean
}

type Fields = Record<string, string>
const EMPTY: Fields = {}

/** One provider card: its connections and the "Add connection" form (steps written for a non-technical owner). */
export const ProviderSection = ({ provider, items, agentNames, localOnly }: ProviderSectionProps) => {
  const t = useT(dict)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState<Fields>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ text: string; keys?: { apiKey: string; webhookUrl: string } } | null>(null)
  const [isPending, startTransition] = useTransition()

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }))
  const v = (k: string) => f[k] ?? ""
  const title = provider === "telegram" ? t("providerTelegram") : provider === "sepay" ? t("providerSepay") : t("providerZalo")
  const blurb = provider === "telegram" ? t("telegramBlurb") : provider === "sepay" ? t("sepayBlurb") : t("zaloBlurb")

  const submit = () => {
    setError(null)
    setDone(null)
    startTransition(async () => {
      let result: Outcome<unknown>
      let after: (() => { text: string; keys?: { apiKey: string; webhookUrl: string } }) | null = null
      if (provider === "telegram") {
        const r = await connectTelegram({ name: v("name"), token: v("token") })
        result = r
        if (r.ok) after = () => ({ text: r.data.webhookRegistered ? t("connectedOk") : `${t("connectedOk")} ${t("localNote")}` })
      } else if (provider === "sepay") {
        const r = await connectSepay({ name: v("name"), accountNumber: v("account"), bankCode: v("bank"), holder: v("holder") })
        result = r
        if (r.ok) after = () => ({ text: `${t("connectedOk")} ${t("keyOnceNote")}`, keys: { apiKey: r.data.apiKey, webhookUrl: r.data.webhookUrl } })
      } else {
        const r = await connectZalo({ name: v("name"), oaId: v("oaId"), appId: v("appId"), appSecret: v("appSecret"), accessToken: v("accessToken"), refreshToken: v("refreshToken") })
        result = r
        if (r.ok) after = () => ({ text: `${t("connectedOk")} ${t("zaloSoon")}` })
      }
      if (!result.ok || !after) {
        setError(result.ok ? null : result.error)
        return
      }
      setDone(after())
      setF(EMPTY)
      setOpen(false)
      router.refresh()
    })
  }

  const field = (k: string, label: string, extra?: { hint?: string; kind?: "password" | "text" }) => (
    <Input key={k} id={`${provider}-${k}`} name={k} label={label} variant="secondary" hint={extra?.hint} kind={extra?.kind ?? "text"} isDisabled={isPending} value={v(k)} onValueChange={set(k)} />
  )

  const steps = (title: string, lines: ReadonlyArray<string>): ReactNode => (
    <div className={FULL_BOX_CLASS}>
      <Text size="sm" weight="semibold">{title}</Text>
      <ol className={STEPS_CLASS}>{lines.map((l) => <li key={l}>{l}</li>)}</ol>
    </div>
  )

  return (
    <SurfaceCard label={title} headingLevel={2}>
      <div className={STACK_CLASS}>
        <div className={HEAD_CLASS}>
          <Text size="sm" tone="muted">{blurb}</Text>
          {open ? null : <Button variant="primary" onPress={() => { setOpen(true); setDone(null) }}>{t("add")}</Button>}
        </div>

        {items.length === 0 && !open ? <Text size="sm" tone="muted">{t("emptyList")}</Text> : null}
        <div>
          {items.map((c) => (
            <ConnectionRow key={c.id} connection={c} localOnly={localOnly} agentNames={c.agentIds.map((id) => agentNames[id]).filter((n): n is string => Boolean(n))} />
          ))}
        </div>

        {done ? (
          <div className={FULL_BOX_CLASS}>
            <Text size="sm" live="polite">{done.text}</Text>
            {done.keys ? <><CopyField label={t("webhookUrl")} value={done.keys.webhookUrl} /><CopyField label={t("apiKey")} value={done.keys.apiKey} /></> : null}
          </div>
        ) : null}

        {open ? (
          <form className={STACK_CLASS} onSubmit={(e) => { e.preventDefault(); submit() }}>
            {provider === "telegram" ? steps(t("tgStepsTitle"), [t("tgStep1"), t("tgStep2"), t("tgStep3"), t("tgStep4")]) : null}
            {provider === "sepay" ? steps(t("sepayStepsTitle"), [t("sepayStep1"), t("sepayStep2"), t("sepayStep3")]) : null}
            {provider === "zalo_oa" ? <Text size="sm">{t("zaloSoon")}</Text> : null}
            <div className={FORM_GRID_CLASS}>
              {field("name", t("fieldName"), { hint: t("fieldNameHint") })}
              {provider === "telegram" ? field("token", t("fieldToken"), { kind: "password" }) : null}
              {provider === "sepay" ? [field("account", t("fieldAccount")), field("bank", t("fieldBank"), { hint: t("fieldBankHint") }), field("holder", t("fieldHolder"))] : null}
              {provider === "zalo_oa" ? [field("oaId", t("fieldOaId")), field("appId", t("fieldAppId")), field("appSecret", t("fieldAppSecret"), { kind: "password" }), field("accessToken", t("fieldAccessToken"), { kind: "password" }), field("refreshToken", t("fieldRefreshToken"), { kind: "password" })] : null}
            </div>
            {error ? <Alert title={error} tone="negative" /> : null}
            <div className={ACTIONS_CLASS}>
              <Button variant="primary" type="submit" isPending={isPending}>{t("connect")}</Button>
              <Button variant="outline" isDisabled={isPending} onPress={() => { setOpen(false); setError(null); setF(EMPTY) }}>{t("cancel")}</Button>
            </div>
          </form>
        ) : null}
      </div>
    </SurfaceCard>
  )
}
