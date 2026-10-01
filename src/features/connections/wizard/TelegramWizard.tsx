"use client"

import { useEffect, useState, useTransition } from "react"
import { Alert, Button, Input, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { connectTelegram, setConnectionAgents, testConnection, type ConnectionCheck } from "@/lib/connection-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { AgentStep, type AgentOption } from "./AgentStep"
import { BUTTONS_CLASS, FIELDS_CLASS } from "./classNames"
import { GuideView } from "./GuideView"
import { WizardFrame } from "./WizardFrame"

/** Props for {@link TelegramWizard}. */
export type TelegramWizardProps = {
  readonly agents: ReadonlyArray<AgentOption>
  readonly onClose: (changed: boolean) => void
}

const STEPS = ["bot", "token", "check", "agent"] as const
const EMPTY_GUIDE = { name: "", webhookUrl: "", apiKey: "", bank: "", account: "" }

/** Telegram in the shared wizard frame: BotFather steps, paste the token, check (getMe + webhook info), attach to the Chatbot agent. */
export const TelegramWizard = ({ agents, onClose }: TelegramWizardProps) => {
  const t = useT(connectionWizard)
  const c = useT(connections)
  const locale = useLocale()
  const def = PROVIDERS.telegram
  const [index, setIndex] = useState(0)
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [connId, setConnId] = useState<string | null>(null)
  const [check, setCheck] = useState<{ tone: "affirmative" | "negative" | "informative"; text: string } | null>(null)
  const [checking, setChecking] = useState(false)
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(agents.map((a) => a.id))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const step = STEPS[index]
  const names = [t("stepBot"), t("stepToken"), t("stepVerify"), t("stepAgent")]
  const go = (to: number) => { setError(null); setIndex(to) }

  const connect = () => startTransition(async () => {
    const r = await connectTelegram({ name, token })
    if (!r.ok) return setError(r.error)
    setConnId(r.data.connection.id)
    go(2)
  })

  const runCheck = async (id: string) => {
    setChecking(true)
    const r = await testConnection(id)
    setChecking(false)
    if (!r.ok) return setCheck({ tone: "negative", text: r.error })
    const d: ConnectionCheck = r.data
    if (d.localOnly) setCheck({ tone: "informative", text: c("checkLocal") })
    else if (d.webhookOk && !d.lastError) setCheck({ tone: "affirmative", text: c("checkOk", { pending: d.pending }) })
    else setCheck({ tone: "negative", text: d.lastError ? c("checkLastError", { error: d.lastError }) : c("checkNotRegistered") })
  }

  useEffect(() => {
    if (step === "check" && connId && !check) void runCheck(connId)
  }, [step, connId, check])

  const finish = () => startTransition(async () => {
    if (!connId) return onClose(false)
    const r = await setConnectionAgents(connId, agentIds)
    if (!r.ok) return setError(r.error)
    onClose(true)
  })

  const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
  const footer =
    step === "bot" ? <><Button variant="primary" onPress={() => go(1)}>{t("next")}</Button><Button variant="ghost" onPress={() => onClose(false)}>{t("close")}</Button></>
    : step === "token" ? <><Button variant="primary" isPending={isPending} isDisabled={!name.trim() || !token.trim()} onPress={connect}>{t("next")}</Button>{back}</>
    : step === "check" ? <><Button variant="primary" isDisabled={checking} onPress={() => go(3)}>{t("next")}</Button><Button variant="outline" isDisabled={checking} onPress={() => connId && void runCheck(connId)}>{t("tgRetry")}</Button></>
    : <><Button variant="primary" isPending={isPending} onPress={finish}>{t("done")}</Button></>

  return (
    <WizardFrame title={t("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
      {step === "bot" ? (
        <>
          <div className={BUTTONS_CLASS}><Button variant="outline" href={def.dashboard.live ?? "https://t.me/BotFather"} target="_blank" rel="noreferrer">{t("openProvider", { brand: "BotFather" })}</Button></div>
          <GuideView brand={def.brand} steps={def.guide} ctx={EMPTY_GUIDE} values={{}} onValue={() => undefined} />
        </>
      ) : null}
      {step === "token" ? (
        <div className={FIELDS_CLASS}>
          <Input id="tg-name" name="name" label={c("fieldName")} variant="secondary" hint={c("fieldNameHint")} isDisabled={isPending} value={name} onValueChange={setName} />
          <Input id="tg-token" name="token" label={c("fieldToken")} variant="secondary" kind="password" hint={t("tgTokenHint")} isDisabled={isPending} value={token} onValueChange={setToken} />
        </div>
      ) : null}
      {step === "check" ? (
        checking && !check ? <Text size="sm" live="polite">{t("tgChecking")}</Text> : check ? <Alert tone={check.tone} title={check.text} /> : null
      ) : null}
      {step === "agent" ? (
        <>
          <Text size="sm" weight="semibold">{t("agentTitleChatbot")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
        </>
      ) : null}
      {error ? <Alert tone="negative" title={error} /> : null}
    </WizardFrame>
  )
}
