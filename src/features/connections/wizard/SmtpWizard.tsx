"use client"

import { useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { email } from "@/i18n/dict/email"
import { sendSmtpTest, startSmtpConnection, type SmtpView } from "@/lib/email-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { SMTP_PRESETS, modeOf, type Security, type SmtpPreset } from "@/lib/email/presets"
import { BUTTONS_CLASS } from "./classNames"
import { CAUTION_LIST_CLASS, SMTP_FIELDS_CLASS, SMTP_PREFILL_CLASS, STEP_ITEM_CLASS, STEP_LIST_CLASS } from "./smtpClassNames"
import { WizardFrame } from "./WizardFrame"

/** Props for {@link SmtpWizard}. */
export type SmtpWizardProps = {
  /** The signed-in person's email: the default address for the test message. */
  readonly ownerEmail: string
  readonly hasDefault: boolean
  readonly onClose: (changed: boolean) => void
}

type Step = "provider" | "guide" | "account" | "verify"
const STEPS: ReadonlyArray<Step> = ["provider", "guide", "account", "verify"]

/**
 * "Email gửi đi" in the shared wizard frame: 1 pick where the mailbox lives (host, port and security are prefilled), 2 a step-by-step guide for a
 * non-technical owner, 3 the sender details and password (stored encrypted, never shown again), 4 "Gửi email thử": the connection becomes
 * active only after one test email is really sent.
 */
export const SmtpWizard = ({ ownerEmail, hasDefault, onClose }: SmtpWizardProps) => {
  const t = useT(email)
  const tw = useT(connectionWizard)
  const locale = useLocale()
  const def = PROVIDERS.smtp
  const [index, setIndex] = useState(0)
  const [presetId, setPresetId] = useState<SmtpPreset["id"]>(SMTP_PRESETS[0].id)
  const preset = SMTP_PRESETS.find((p) => p.id === presetId) ?? SMTP_PRESETS[0]
  const [modeId, setModeId] = useState(preset.modes[0].id)
  const mode = modeOf(preset, modeId)
  const [host, setHost] = useState(mode.host)
  const [port, setPort] = useState(String(mode.port))
  const [security, setSecurity] = useState<Security>(mode.security)
  const [f, setF] = useState({ fromName: "", fromEmail: "", replyTo: "", user: "", password: "" })
  const [conn, setConn] = useState<SmtpView | null>(null)
  const [testTo, setTestTo] = useState(ownerEmail)
  const [makeDefault, setMakeDefault] = useState(!hasDefault)
  const [tested, setTested] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const step = STEPS[index]
  const names = [t("stepProvider"), t("stepGuide"), t("stepAccount"), t("stepVerify")]
  const go = (to: number) => { setError(null); setIndex(to) }

  const applyMode = (p: SmtpPreset, id: string) => {
    const m = modeOf(p, id)
    setModeId(m.id)
    setHost(m.host)
    setPort(String(m.port))
    setSecurity(m.security)
  }
  const pickPreset = (id: string) => {
    const p = SMTP_PRESETS.find((x) => x.id === id) ?? SMTP_PRESETS[0]
    setPresetId(p.id)
    applyMode(p, p.modes[0].id)
  }
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }))

  const username = mode.fixedUser ?? (f.user.trim() || (mode.userIsEmail ? f.fromEmail.trim() : ""))
  const needsUserField = Boolean(mode.hostEditable) || (!mode.userIsEmail && !mode.fixedUser)
  const needsPassword = !(preset.id === "google_workspace" && mode.id === "relay")
  const ready = f.fromName.trim() && f.fromEmail.trim() && username && host.trim() && (!needsPassword || f.password.trim())

  const save = () => {
    if (conn) return go(3)
    startTransition(async () => {
      const r = await startSmtpConnection({
        preset: preset.id, host, port: Number(port), security, user: username, password: f.password, fromName: f.fromName, fromEmail: f.fromEmail, replyTo: f.replyTo,
      })
      if (!r.ok) return setError(r.error)
      setConn(r.data)
      setF((p) => ({ ...p, password: "" }))
      go(3)
    })
  }

  const sendTest = () => {
    if (!conn) return
    startTransition(async () => {
      setError(null)
      const r = await sendSmtpTest(conn.id, testTo, makeDefault)
      if (!r.ok) return setError(r.error)
      setTested(r.data.to)
    })
  }

  const securityLabel = security === "tls" ? t("secTls") : t("secStarttls")
  const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
  const footer =
    step === "provider" ? <><Button variant="primary" onPress={() => go(1)}>{t("next")}</Button><Button variant="ghost" onPress={() => onClose(false)}>{t("close")}</Button></>
    : step === "guide" ? <><Button variant="primary" onPress={() => go(2)}>{t("next")}</Button>{back}</>
    : step === "account" ? <><Button variant="primary" isPending={isPending} isDisabled={!conn && !ready} onPress={save}>{t("saveContinue")}</Button>{conn ? null : back}</>
    : tested ? <Button variant="primary" onPress={() => onClose(true)}>{t("done")}</Button>
    : <><Button variant="primary" isPending={isPending} isDisabled={!testTo.trim()} onPress={sendTest}>{isPending ? t("testSending") : t("testSend")}</Button><Button variant="ghost" isDisabled={isPending} onPress={() => onClose(true)}>{t("close")}</Button></>

  return (
    <WizardFrame title={tw("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
      {step === "provider" ? (
        <>
          <Text size="sm" tone="muted">{t("chooseHint")}</Text>
          <RadioGroup
            label={t("stepProvider")} isLabelHidden value={preset.id} onValueChange={pickPreset}
            options={SMTP_PRESETS.map((p) => ({ value: p.id, label: p.title[locale], description: p.blurb[locale] }))}
          />
          {preset.modes.length > 1 ? (
            <>
              <Text size="sm" weight="semibold">{t("modeTitle")}</Text>
              <RadioGroup
                label={t("modeTitle")} isLabelHidden value={mode.id} onValueChange={(v) => applyMode(preset, v)}
                options={preset.modes.map((m) => ({ value: m.id, label: m.label[locale], description: m.when[locale] }))}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === "guide" ? (
        <>
          <Text size="sm" weight="semibold">{mode.label[locale]}</Text>
          <Text size="sm" tone="muted">{mode.when[locale]}</Text>
          {mode.host ? <div className={SMTP_PREFILL_CLASS}>{t("prefilled", { host: mode.host, port: mode.port, security: mode.security === "tls" ? t("secTls") : t("secStarttls") })}</div> : null}
          <Text size="sm" weight="semibold">{t("stepsTitle")}</Text>
          <ol className={STEP_LIST_CLASS}>
            {mode.steps.map((s) => (
              <li key={s.text.vi}>
                <div className={STEP_ITEM_CLASS}>
                  <span>{s.text[locale]}</span>
                  {s.link ? <div className={BUTTONS_CLASS}><Button variant="outline" href={s.link.url} target="_blank" rel="noreferrer">{s.link.label[locale]}</Button></div> : null}
                </div>
              </li>
            ))}
          </ol>
          {mode.cautions.length ? (
            <Alert tone="cautionary" title={t("cautionTitle")} description={mode.cautions.map((c) => c[locale]).join(" ")} />
          ) : null}
        </>
      ) : null}

      {step === "account" ? (
        <>
          <div className={SMTP_FIELDS_CLASS}>
            <Input id="smtp-from-name" name="fromName" label={t("fieldFromName")} variant="secondary" hint={t("fieldFromNameHint")} isDisabled={Boolean(conn) || isPending} value={f.fromName} onValueChange={set("fromName")} />
            <Input id="smtp-from-email" name="fromEmail" label={t("fieldFromEmail")} variant="secondary" hint={t("fieldFromEmailHint")} isDisabled={Boolean(conn) || isPending} value={f.fromEmail} onValueChange={set("fromEmail")} />
            <Input id="smtp-reply-to" name="replyTo" label={t("fieldReplyTo")} variant="secondary" hint={t("fieldReplyToHint")} isDisabled={Boolean(conn) || isPending} value={f.replyTo} onValueChange={set("replyTo")} />
            {mode.hostEditable ? (
              <>
                <Input id="smtp-host" name="host" label={t("fieldHost")} variant="secondary" isDisabled={Boolean(conn) || isPending} value={host} onValueChange={setHost} />
                <Input id="smtp-port" name="port" label={t("fieldPort")} variant="secondary" isDisabled={Boolean(conn) || isPending} value={port} onValueChange={setPort} />
                <Select
                  label={t("fieldSecurity")} isDisabled={Boolean(conn) || isPending} value={security}
                  options={[{ id: "starttls", label: `${t("secStarttls")} (587)` }, { id: "tls", label: `${t("secTls")} (465)` }]} onValueChange={(v) => setSecurity(v === "tls" ? "tls" : "starttls")}
                />
              </>
            ) : null}
            {needsUserField ? <Input id="smtp-user" name="user" label={t("fieldUser")} variant="secondary" hint={t("fieldUserHint")} isDisabled={Boolean(conn) || isPending} value={f.user} onValueChange={set("user")} /> : null}
            {needsPassword ? (
              <Input id="smtp-password" name="password" label={mode.passwordLabel[locale]} variant="secondary" kind="password" hint={conn ? undefined : mode.passwordHint[locale]} isDisabled={Boolean(conn) || isPending} value={conn ? "" : f.password} onValueChange={set("password")} />
            ) : null}
          </div>
          {mode.fixedUser ? <Text size="xs" tone="muted">{t("fixedUser", { user: mode.fixedUser })}</Text> : null}
          {!mode.hostEditable && mode.host ? <Text size="xs" tone="muted">{t("prefilled", { host, port, security: securityLabel })}</Text> : null}
          <Text size="xs" tone="muted">{t("passwordStored")}</Text>
        </>
      ) : null}

      {step === "verify" ? (
        <>
          <Text size="sm" tone="muted">{t("notConnectedYet")}</Text>
          <Input id="smtp-test-to" name="testTo" label={t("testTo")} variant="secondary" hint={t("testToHint")} isDisabled={isPending || Boolean(tested)} value={testTo} onValueChange={setTestTo} />
          <CheckboxGroup
            label={t("makeDefault")} isLabelHidden isDisabled={isPending || Boolean(tested)}
            options={[{ value: "default", label: t("makeDefault"), description: t("makeDefaultHint") }]}
            value={makeDefault ? ["default"] : []} onValueChange={(v) => setMakeDefault(v.includes("default"))}
          />
          {tested ? <Alert tone="affirmative" title={t("testOk", { to: tested })} /> : null}
        </>
      ) : null}

      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
