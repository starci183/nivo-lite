"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, SegmentedControl, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectorTelegramUser } from "@/i18n/dict/connectorTelegramUser"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { setConnectionAgents } from "@/lib/connection-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import {
  cancelTelegramLogin, listTelegramChats, loadTelegramUserSetup, resendTelegramCode, saveTelegramUserSetup, startTelegramLogin,
  submitTelegramCode, submitTelegramPassword, telegramUserReady,
} from "@/lib/connectors/telegram-user-actions"
import { AgentStep } from "../AgentStep"
import { FIELDS_CLASS } from "../classNames"
import { WizardFrame } from "../WizardFrame"
import { ChatPicker } from "./tguser/ChatPicker"
import type { ChatChoice, PickedChat, SinceDays } from "./tguser/shared"
import type { DataWizardProps } from "./types"

type Stage = "phone" | "code" | "password"

/** Setup of a personal Telegram connection (owner only): consent, phone login, chat picks, schedule, agents. */
export const TelegramUserWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
  const t = useT(connectorTelegramUser)
  const w = useT(connectionWizard)
  const locale = useLocale()
  const title = w("title", { provider: PROVIDERS.telegram_user.title[locale] })
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [index, setIndex] = useState(0)
  const [name, setName] = useState("")
  const [consent, setConsent] = useState(false)
  const [stage, setStage] = useState<Stage>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [password, setPassword] = useState("")
  const [connId, setConnId] = useState<string | null>(resumeId ?? null)
  const [sentVia, setSentVia] = useState<string | null>(null)
  const [chats, setChats] = useState<ReadonlyArray<ChatChoice>>([])
  const [chatsState, setChatsState] = useState<"idle" | "loading" | "done">("idle")
  const [picked, setPicked] = useState<ReadonlyArray<PickedChat>>([])
  const [sinceDays, setSinceDays] = useState<SinceDays>(7)
  const [every, setEvery] = useState<string>("0")
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const names = [t("stepConsent"), t("stepLogin"), t("stepChats"), t("stepSchedule"), t("stepAgent")]
  const go = (to: number) => { setError(null); setIndex(to) }

  const loadChats = useCallback(async (id: string) => {
    setChatsState("loading")
    const r = await listTelegramChats(id)
    setChatsState("done")
    if (!r.ok) return setError(r.error)
    setChats(r.data)
  }, [])

  // Is the server set up, and is this a resumed login or an edit of an existing connection?
  useEffect(() => {
    void (async () => {
      const ready = await telegramUserReady()
      setConfigured(ready.ok ? ready.data.configured : false)
      if (!resumeId) return
      const s = await loadTelegramUserSetup(resumeId)
      if (!s.ok) return setError(s.error)
      setName(s.data.name)
      setConsent(s.data.consent)
      setEvery(String(s.data.everyMinutes ?? 0))
      if (s.data.config) { setPicked(s.data.config.chats); setSinceDays(s.data.config.sinceDays) }
      if (s.data.stage === "ready") { setEditing(true); setIndex(2); void loadChats(resumeId) }
      else { setStage(s.data.stage); setIndex(1) }
    })()
  }, [resumeId, loadChats])

  const afterLogin = (id: string) => { setCode(""); setPassword(""); setIndex(2); setError(null); void loadChats(id) }

  const sendCode = () => startTransition(async () => {
    const r = await startTelegramLogin({ name, phone, consent, ...(connId ? { connectionId: connId } : {}) })
    if (!r.ok) return setError(r.error)
    setConnId(r.data.connectionId)
    setSentVia(r.data.viaApp ? t("codeSentApp") : t("codeSentSms"))
    setStage("code")
    setError(null)
  })

  const confirmCode = () => startTransition(async () => {
    if (!connId) return
    const r = await submitTelegramCode({ connectionId: connId, code })
    if (!r.ok) return setError(r.error)
    if (r.data.stage === "password") { setStage("password"); setCode(""); return setError(null) }
    afterLogin(connId)
  })

  const confirmPassword = () => startTransition(async () => {
    if (!connId) return
    const r = await submitTelegramPassword({ connectionId: connId, password })
    if (!r.ok) return setError(r.error)
    afterLogin(connId)
  })

  const resend = () => startTransition(async () => {
    if (!connId) return
    const r = await resendTelegramCode(connId)
    if (!r.ok) return setError(r.error)
    setSentVia(t("resent"))
    setError(null)
  })

  const cancel = () => startTransition(async () => {
    if (connId) await cancelTelegramLogin(connId)
    onClose(false)
  })

  const save = () => startTransition(async () => {
    if (!connId) return
    const r = await saveTelegramUserSetup({ connectionId: connId, chats: picked, sinceDays, everyMinutes: Number(every) || null })
    if (!r.ok) return setError(r.error)
    if (editing) return onClose(true)
    go(4)
  })

  const finish = () => startTransition(async () => {
    if (!connId) return onClose(true)
    const r = await setConnectionAgents(connId, agentIds)
    if (!r.ok) return setError(r.error)
    onClose(true)
  })

  const back = (to: number) => <Button variant="outline" isDisabled={isPending} onPress={() => go(to)}>{t("back")}</Button>
  const loginFooter = stage === "phone"
    ? <><Button variant="primary" isPending={isPending} isDisabled={!phone.trim()} onPress={sendCode}>{t("sendCode")}</Button>{back(0)}</>
    : stage === "code"
      ? <>
          <Button variant="primary" isPending={isPending} isDisabled={code.replace(/\D/g, "").length < 4} onPress={confirmCode}>{t("confirmCode")}</Button>
          <Button variant="outline" isDisabled={isPending} onPress={resend}>{t("resend")}</Button>
          <Button variant="ghost" isDisabled={isPending} onPress={cancel}>{t("cancelLogin")}</Button>
        </>
      : <>
          <Button variant="primary" isPending={isPending} isDisabled={!password} onPress={confirmPassword}>{t("signIn")}</Button>
          <Button variant="ghost" isDisabled={isPending} onPress={cancel}>{t("cancelLogin")}</Button>
        </>

  const footer =
    index === 0 ? <><Button variant="primary" isDisabled={!name.trim() || !consent} onPress={() => go(1)}>{t("next")}</Button><Button variant="ghost" onPress={() => onClose(false)}>{t("close")}</Button></>
    : index === 1 ? loginFooter
    : index === 2 ? <><Button variant="primary" isDisabled={picked.length === 0 || chatsState === "loading"} onPress={() => go(3)}>{t("next")}</Button>{connId && chatsState === "done" && error ? <Button variant="outline" onPress={() => { setError(null); void loadChats(connId) }}>{t("chatsRetry")}</Button> : null}<Button variant="ghost" onPress={() => onClose(false)}>{t("close")}</Button></>
    : index === 3 ? <><Button variant="primary" isPending={isPending} onPress={save}>{t("save")}</Button>{back(2)}</>
    : <Button variant="primary" isPending={isPending} onPress={finish}>{t("done")}</Button>

  if (configured === false) {
    return (
      <WizardFrame title={title} steps={names} index={0} footer={<Button variant="primary" onPress={() => onClose(false)}>{t("close")}</Button>}>
        <Alert tone="negative" title={t("notConfiguredTitle")} description={t("notConfiguredBody")} />
      </WizardFrame>
    )
  }

  return (
    <WizardFrame title={title} steps={names} index={index} footer={footer}>
      {index === 0 ? (
        <>
          <div className={FIELDS_CLASS}>
            <Input id="tgu-name" name="name" label={t("nameLabel")} variant="secondary" hint={t("nameHint")} isDisabled={isPending} value={name} onValueChange={setName} />
          </div>
          <Text size="sm" weight="semibold">{t("consentTitle")}</Text>
          <Text size="sm">{t("consent1")}</Text>
          <Text size="sm">{t("consent2")}</Text>
          <Text size="sm">{t("consent3")}</Text>
          <CheckboxGroup variant="secondary" label={t("consentTitle")} isLabelHidden
            options={[{ value: "yes", label: t("consentLabel") }]} value={consent ? ["yes"] : []} onValueChange={(v) => setConsent(v.includes("yes"))} />
        </>
      ) : null}
      {index === 1 ? (
        <div className={FIELDS_CLASS}>
          {stage === "phone" ? (
            <Input id="tgu-phone" name="phone" kind="tel" label={t("phoneLabel")} variant="secondary" hint={t("phoneHint")} isDisabled={isPending} value={phone} onValueChange={setPhone} />
          ) : null}
          {stage === "code" ? (
            <>
              {sentVia ? <Text size="sm" live="polite">{sentVia}</Text> : null}
              <Input id="tgu-code" name="code" kind="code" label={t("codeLabel")} variant="secondary" hint={t("codeHint")} isDisabled={isPending} value={code} onValueChange={setCode} />
            </>
          ) : null}
          {stage === "password" ? (
            <>
              <Text size="sm" weight="semibold">{t("passwordTitle")}</Text>
              <Input id="tgu-password" name="password" kind="password" label={t("passwordLabel")} variant="secondary" hint={t("passwordHint")} isDisabled={isPending} value={password} onValueChange={setPassword} />
            </>
          ) : null}
        </div>
      ) : null}
      {index === 2 ? (
        chatsState === "loading" ? <Text size="sm" live="polite">{t("chatsLoading")}</Text> : (
          <>
            <ChatPicker chats={chats} picked={picked} onPicked={setPicked} isDisabled={isPending} />
            <SegmentedControl label={t("sinceLabel")} value={String(sinceDays)}
              options={[{ value: "7", label: t("since7") }, { value: "30", label: t("since30") }]}
              onValueChange={(v) => setSinceDays(v === "30" ? 30 : 7)} />
          </>
        )
      ) : null}
      {index === 3 ? (
        <>
          <SegmentedControl label={t("scheduleLabel")} value={every} width="fill"
            options={[{ value: "0", label: t("scheduleManual") }, { value: "15", label: t("schedule15") }, { value: "60", label: t("schedule60") }]}
            onValueChange={setEvery} />
          <Text size="sm" tone="muted">{t("scheduleHint")}</Text>
        </>
      ) : null}
      {index === 4 ? (
        <>
          <Text size="sm" weight="semibold">{t("agentTitle")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
        </>
      ) : null}
      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
