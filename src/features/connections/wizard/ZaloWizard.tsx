"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { Alert, Button, Input, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import {
  checkFirstEvent, resumeZalo, saveZaloOaSecret, setConnectionAgents, startZaloConnection, zaloAuthorizeUrl, type FirstEventState, type ZaloWizardConnection,
} from "@/lib/connection-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { AgentStep, type AgentOption } from "./AgentStep"
import { BUTTONS_CLASS, FIELDS_CLASS, PULSE_CLASS, WAITING_CLASS } from "./classNames"
import { GuideView } from "./GuideView"
import { WizardFrame } from "./WizardFrame"

/** Props for {@link ZaloWizard}. */
export type ZaloWizardProps = {
  /** Continue this unfinished connection instead of creating a new one. */
  readonly resumeId?: string
  /** How the Zalo sign-in ended when the browser came back: ok | denied | failed | expired. */
  readonly returned?: string
  readonly agents: ReadonlyArray<AgentOption>
  readonly onClose: (changed: boolean) => void
}

type Step = "app" | "follow" | "authorize" | "verify" | "agent"
const STEPS: ReadonlyArray<Step> = ["app", "follow", "authorize", "verify", "agent"]
const POLL_MS = 3000

/** Waits for the first customer message (asks every 3 seconds) and says who wrote. */
const ZaloVerify = ({ connectionId, initial, onReceived }: { readonly connectionId: string; readonly initial: FirstEventState["firstEvent"]; readonly onReceived: () => void }) => {
  const t = useT(connectionWizard)
  const [event, setEvent] = useState(initial)
  const notify = useRef(onReceived)
  notify.current = onReceived

  useEffect(() => {
    if (event) return
    let stop = false
    const tick = async () => {
      const r = await checkFirstEvent(connectionId).catch(() => null)
      if (stop || !r || !r.ok || !r.data.firstEvent) return
      setEvent(r.data.firstEvent)
      notify.current()
    }
    const timer = setInterval(tick, POLL_MS)
    void tick()
    return () => { stop = true; clearInterval(timer) }
  }, [connectionId, event])

  return (
    <>
      <Text size="sm">{t("zaloVerifyIntro")}</Text>
      {event ? (
        <Alert tone="affirmative" title={t("zaloVerifyReceived", { name: event.content || "Zalo" })} />
      ) : (
        <div className={WAITING_CLASS} role="status" aria-live="polite">
          <span className={PULSE_CLASS} aria-hidden="true" />
          <Text size="sm" weight="medium">{t("zaloVerifyWaiting")}</Text>
        </div>
      )}
    </>
  )
}

/**
 * Zalo OA in the shared wizard frame, like the SePay one: name and app keys, set up the Zalo app (callback + webhook URLs to copy, events,
 * the OA Secret Key to paste), "Kết nối Zalo OA" (OAuth with PKCE, the browser comes back here), check (message your OA, NIVO shows who wrote), agent.
 */
export const ZaloWizard = ({ resumeId, returned, agents, onClose }: ZaloWizardProps) => {
  const t = useT(connectionWizard)
  const c = useT(connections)
  const locale = useLocale()
  const def = PROVIDERS.zalo_oa
  const [index, setIndex] = useState(0)
  const [f, setF] = useState({ name: "", appId: "", appSecret: "" })
  const [oaSecret, setOaSecret] = useState("")
  const [oaSaved, setOaSaved] = useState(false)
  const [conn, setConn] = useState<ZaloWizardConnection | null>(null)
  const [received, setReceived] = useState(false)
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(agents.map((a) => a.id))
  const [note, setNote] = useState<{ tone: "affirmative" | "negative" | "informative"; text: string } | null>(null)
  const [loading, setLoading] = useState(Boolean(resumeId))
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!resumeId) return
    let stop = false
    void (async () => {
      const r = await resumeZalo(resumeId)
      if (stop) return
      if (!r.ok) setNote({ tone: "negative", text: r.error })
      else {
        setConn(r.data)
        setOaSaved(r.data.oaSecretSaved)
        setReceived(Boolean(r.data.firstEvent))
        if (r.data.agentIds.length) setAgentIds(r.data.agentIds)
        const failed = returned === "denied" ? t("zaloAuthDenied") : returned === "failed" ? t("zaloAuthFailed") : returned === "expired" ? t("zaloAuthExpired") : null
        if (failed) setNote({ tone: "negative", text: failed })
        setIndex(failed ? 2 : r.data.authorized ? 3 : r.data.oaSecretSaved ? 2 : 1)
      }
      setLoading(false)
    })()
    return () => { stop = true }
  }, [resumeId, returned, t])

  const step = STEPS[index]
  const names = [t("zaloStepApp"), t("zaloStepFollow"), t("zaloStepAuthorize"), t("stepVerify"), t("stepAgent")]
  const go = (to: number) => { setNote(null); setIndex(to) }
  const fail = (text: string) => setNote({ tone: "negative", text })

  const create = () => {
    if (conn) return go(1)
    startTransition(async () => {
      const r = await startZaloConnection(f)
      if (!r.ok) return fail(r.error)
      setConn(r.data)
      go(1)
    })
  }

  const saveSecret = () => {
    if (!conn) return
    if (oaSaved && !oaSecret.trim()) return go(2)
    startTransition(async () => {
      const r = await saveZaloOaSecret(conn.id, oaSecret)
      if (!r.ok) return fail(r.error)
      setOaSaved(true)
      setOaSecret("")
      go(2)
    })
  }

  const authorize = () => {
    if (!conn) return
    startTransition(async () => {
      const r = await zaloAuthorizeUrl(conn.id)
      if (!r.ok) return fail(r.error)
      window.location.assign(r.data.url)
    })
  }

  const finish = () => {
    if (!conn) return onClose(false)
    startTransition(async () => {
      const r = await setConnectionAgents(conn.id, agentIds)
      if (!r.ok) return fail(r.error)
      onClose(true)
    })
  }

  const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
  const footer =
    step === "app" ? <><Button variant="primary" isPending={isPending} isDisabled={!conn && (!f.name.trim() || !f.appId.trim() || !f.appSecret.trim())} onPress={create}>{t("next")}</Button><Button variant="ghost" onPress={() => onClose(conn !== null)}>{t("close")}</Button></>
    : step === "follow" ? <><Button variant="primary" isPending={isPending} isDisabled={!oaSaved && oaSecret.trim().length < 8} onPress={saveSecret}>{oaSecret.trim() ? t("zaloSaveOaSecret") : t("next")}</Button>{back}</>
    : step === "authorize" ? <><Button variant="primary" isPending={isPending} onPress={authorize}>{conn?.authorized ? t("zaloReauthorize") : t("zaloAuthorize")}</Button>{conn?.authorized ? <Button variant="outline" onPress={() => go(3)}>{t("next")}</Button> : null}{back}</>
    : step === "verify" ? (received ? <><Button variant="primary" onPress={() => go(4)}>{t("next")}</Button>{back}</> : <><Button variant="outline" onPress={() => go(4)}>{t("skip")}</Button>{back}</>)
    : <><Button variant="primary" isPending={isPending} onPress={finish}>{t("done")}</Button>{back}</>

  if (loading) return <Text size="sm" tone="muted" live="polite">{t("verifyWaiting")}</Text>

  return (
    <WizardFrame title={t("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
      {step === "app" ? (
        <>
          <div className={BUTTONS_CLASS}><Button variant="outline" href={def.dashboard.live ?? "https://developers.zalo.me/apps"} target="_blank" rel="noreferrer">{t("openProvider", { brand: def.brand })}</Button></div>
          <GuideView brand={def.brand} steps={def.guide.slice(0, 1)} ctx={{ name: "", webhookUrl: "", apiKey: "", bank: "", account: "" }} values={{}} onValue={() => undefined} />
          <div className={FIELDS_CLASS}>
            <Input id="zalo-name" name="name" label={c("fieldName")} variant="secondary" hint={c("fieldNameHint")} isDisabled={Boolean(conn) || isPending} value={conn ? conn.name : f.name} onValueChange={(v) => setF((p) => ({ ...p, name: v }))} />
            <Input id="zalo-appId" name="appId" label={c("fieldAppId")} variant="secondary" hint={t("zaloAppHint")} isDisabled={Boolean(conn) || isPending} value={conn ? "••••••" : f.appId} onValueChange={(v) => setF((p) => ({ ...p, appId: v }))} />
            <Input id="zalo-appSecret" name="appSecret" label={c("fieldAppSecret")} variant="secondary" kind="password" isDisabled={Boolean(conn) || isPending} value={conn ? "••••••••" : f.appSecret} onValueChange={(v) => setF((p) => ({ ...p, appSecret: v }))} />
          </div>
          {conn ? <Text size="xs" tone="muted">{t("createdLocked")}</Text> : null}
        </>
      ) : null}

      {step === "follow" && conn ? (
        <>
          <div className={BUTTONS_CLASS}><Button variant="outline" href={def.dashboard.live ?? "https://developers.zalo.me/apps"} target="_blank" rel="noreferrer">{t("openProvider", { brand: def.brand })}</Button></div>
          <GuideView
            brand={def.brand} steps={def.guide.slice(1)} ctx={{ name: conn.name, webhookUrl: conn.webhookUrl, callbackUrl: conn.callbackUrl, apiKey: "", bank: "", account: "" }}
            values={{ oaSecret }} onValue={(_, v) => setOaSecret(v)} isDisabled={isPending}
          />
          {oaSaved ? <Text size="xs" tone="muted" live="polite">{t("zaloOaSecretSaved")}</Text> : <Text size="xs" tone="muted">{t("zaloNeedSecret")}</Text>}
        </>
      ) : null}

      {step === "authorize" && conn ? (
        <>
          <Text size="sm">{t("zaloAuthorizeBody")}</Text>
          {conn.authorized ? <Alert tone="affirmative" title={t("zaloAuthorized", { oa: conn.oaId ? ` (OA ${conn.oaId})` : "" })} /> : null}
        </>
      ) : null}

      {step === "verify" && conn ? <ZaloVerify connectionId={conn.id} initial={conn.firstEvent} onReceived={() => setReceived(true)} /> : null}

      {step === "agent" ? (
        <>
          {!received ? <Alert tone="informative" title={t("zaloSkipNote")} /> : null}
          <Text size="sm" weight="semibold">{t("agentTitleChatbot")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
        </>
      ) : null}

      {note ? <Alert tone={note.tone} title={note.text} /> : null}
    </WizardFrame>
  )
}
