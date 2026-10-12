"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Alert, Button, RadioGroup, Spinner, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { metaWizard } from "@/i18n/dict/metaWizard"
import { checkFirstEvent, setConnectionAgents } from "@/lib/connection-actions"
import { PROVIDERS } from "@/lib/connection-providers"
import { chooseMetaPage, resumeMeta, startMetaConnect, testMeta, type AppObjectCheck, type MetaCheck, type MetaWizardConnection } from "@/lib/meta-actions"
import { AgentStep, type AgentOption } from "./AgentStep"
import { COPY_CLASS } from "./classNames"
import { WizardFrame } from "./WizardFrame"

/** Props for {@link MetaWizard}. */
export type MetaWizardProps = {
  /** Continue this unfinished connection instead of creating a new one. */
  readonly resumeId?: string
  /** How the Facebook login ended when the browser came back: ok | denied | failed | expired | nopages | unavailable. */
  readonly returned?: string
  readonly agents: ReadonlyArray<AgentOption>
  readonly onClose: (changed: boolean) => void
}

type Step = "connect" | "pick" | "agent" | "test"
const STEPS: ReadonlyArray<Step> = ["connect", "pick", "agent", "test"]
const POLL_MS = 3000

type Translate = ReturnType<typeof useT<typeof metaWizard.en>>

/** One line per fact Meta reported, in the owner's words. */
const checkLines = (r: MetaCheck, m: Translate): ReadonlyArray<{ readonly key: string; readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }> => {
  const lines: Array<{ key: string; tone: "affirmative" | "negative" | "informative"; text: string }> = []
  if (!r.tokenOk) return [{ key: "token", tone: "negative", text: m("testToken") }]
  const list = (xs: ReadonlyArray<string>) => xs.join(", ")
  lines.push(
    !r.page.subscribed ? { key: "page", tone: "negative", text: m("testPageNone") }
    : r.page.missing.length ? { key: "page", tone: "negative", text: m("testPageMissing", { fields: list(r.page.missing) }) }
    : { key: "page", tone: "affirmative", text: m("testPageOk", { fields: list(r.page.fields) }) },
  )
  const app = (key: string, objectLabel: string, o: AppObjectCheck | null) => {
    if (!r.appKnown) return
    if (!o) lines.push({ key, tone: "negative", text: m("testAppNone", { object: objectLabel }) })
    else if (!o.urlMatches) lines.push({ key, tone: "negative", text: m("testAppUrl", { object: objectLabel, url: o.callbackUrl }) })
    else if (o.missing.length) lines.push({ key, tone: "negative", text: m("testAppMissing", { object: objectLabel, fields: list(o.missing) }) })
    else lines.push({ key, tone: "affirmative", text: m("testAppOk", { object: objectLabel, fields: list(o.fields) }) })
  }
  app("app-page", m("testAppPage"), r.appPage)
  if (r.igUsername) app("app-ig", m("testAppInstagram"), r.appInstagram)
  if (!r.appKnown) lines.push({ key: "app-unknown", tone: "informative", text: m("testAppUnknown", { url: r.webhookUrl }) })
  if (r.localOnly) lines.push({ key: "local", tone: "informative", text: m("testLocal") })
  if (!r.verifyTokenSet) lines.push({ key: "verify", tone: "negative", text: m("testNoVerify") })
  return lines
}

/** The test step: what Meta really has for this Page (asks on entry and on demand), then waits for the first event (asks every 3 seconds). */
const MetaTest = ({ connectionId, initial, onReceived }: { readonly connectionId: string; readonly initial: MetaWizardConnection["firstEvent"]; readonly onReceived: () => void }) => {
  const m = useT(metaWizard)
  const [check, setCheck] = useState<MetaCheck | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(true)
  const [event, setEvent] = useState(initial)
  const notify = useRef(onReceived)
  notify.current = onReceived

  const run = useCallback(async (repair: boolean) => {
    setBusy(true)
    setError(null)
    const r = await testMeta(connectionId, { repair }).catch(() => null)
    if (!r) setError(m("errGeneric"))
    else if (!r.ok) setError(r.error)
    else setCheck(r.data)
    setBusy(false)
  }, [connectionId, m])

  useEffect(() => { void run(false) }, [run])

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
      <Text size="sm">{m("testIntro")}</Text>
      {check ? (
        <div className={COPY_CLASS}>
          <Text size="sm" weight="semibold">{m("pageLine", { page: check.pageName })}</Text>
          <Text size="xs" tone="muted">{check.igUsername ? m("igLine", { handle: check.igUsername }) : m("noIgLine")}</Text>
          {checkLines(check, m).map((l) => <Alert key={l.key} tone={l.tone} title={l.text} />)}
          {check.ok ? <Alert tone="affirmative" title={m("testAllGood")} /> : null}
        </div>
      ) : null}
      {busy ? <Text size="sm" weight="medium" startContent={<Spinner size="sm" label={m("testWorking")} />}>{m("testWorking")}</Text> : null}
      {error ? <Alert tone="negative" title={error} /> : null}
      <div className={COPY_CLASS}>
        <Button variant="outline" isDisabled={busy} onPress={() => void run(false)}>{m("testRun")}</Button>
        {check && !check.ok && check.tokenOk ? <Button variant="outline" isDisabled={busy} onPress={() => void run(true)}>{m("testRepair")}</Button> : null}
      </div>
      {event ? (
        <Alert tone="affirmative" title={m("testReceived", { name: event.content || "Meta" })} />
      ) : (
        <Text size="sm" weight="medium" startContent={<Spinner size="sm" label={m("testWaiting")} />}>{m("testWaiting")}</Text>
      )}
    </>
  )
}

/**
 * Facebook Pages + Instagram in the shared wizard frame: log in with Facebook (the browser leaves for Meta and comes back here), pick the Page
 * (its linked Instagram account comes with it), attach the agents (AgentStep), then a test step that shows the webhook subscription status
 * as Meta reports it and waits for the first message or comment.
 */
export const MetaWizard = ({ resumeId, returned, agents, onClose }: MetaWizardProps) => {
  const t = useT(connectionWizard)
  const m = useT(metaWizard)
  const locale = useLocale()
  const def = PROVIDERS.meta
  const [index, setIndex] = useState(0)
  const [conn, setConn] = useState<MetaWizardConnection | null>(null)
  const [pageId, setPageId] = useState("")
  const [received, setReceived] = useState(false)
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(agents.map((a) => a.id))
  const [note, setNote] = useState<{ tone: "affirmative" | "negative" | "informative"; text: string } | null>(null)
  const [loading, setLoading] = useState(Boolean(resumeId))
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!resumeId) return
    let stop = false
    void (async () => {
      const r = await resumeMeta(resumeId)
      if (stop) return
      if (!r.ok) setNote({ tone: "negative", text: r.error })
      else {
        setConn(r.data)
        setReceived(Boolean(r.data.firstEvent))
        if (r.data.agentIds.length) setAgentIds(r.data.agentIds)
        if (r.data.pages.length === 1) setPageId(r.data.pages[0].id)
        const failed =
          returned === "denied" ? m("authDenied") : returned === "failed" ? m("authFailed") : returned === "expired" ? m("authExpired")
          : returned === "nopages" ? m("authNoPages") : returned === "unavailable" ? m("authUnavailable") : null
        if (failed) setNote({ tone: "negative", text: failed })
        else if (returned === "ok") setNote({ tone: "affirmative", text: m("loggedIn") })
        setIndex(failed ? 0 : r.data.pages.length > 0 ? 1 : r.data.pageId ? 2 : 0)
      }
      setLoading(false)
    })()
    return () => { stop = true }
  }, [resumeId, returned, m])

  const step = STEPS[index]
  const names = [m("stepConnect"), m("stepPick"), m("stepAgent"), m("stepTest")]
  const go = (to: number) => { setNote(null); setIndex(to) }
  const fail = (text: string) => setNote({ tone: "negative", text })

  const login = () => startTransition(async () => {
    setNote(null)
    const r = await startMetaConnect({ ...(conn ? { connectionId: conn.id } : {}) })
    if (!r.ok) return fail(r.error)
    window.location.assign(r.data.url)
  })

  const choose = () => {
    if (!conn || !pageId) return fail(m("pickPick"))
    startTransition(async () => {
      const r = await chooseMetaPage(conn.id, pageId)
      if (!r.ok) return fail(r.error)
      setConn(r.data)
      go(2)
    })
  }

  const saveAgents = () => {
    if (!conn) return go(3)
    startTransition(async () => {
      const r = await setConnectionAgents(conn.id, agentIds)
      if (!r.ok) return fail(r.error)
      go(3)
    })
  }

  const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
  const waiting = conn !== null && conn.pages.length > 0
  const footer =
    step === "connect" ? <><Button variant="primary" isPending={isPending} onPress={login}>{conn ? m("reconnect") : m("connect")}</Button>{waiting || conn?.pageId ? <Button variant="outline" isDisabled={isPending} onPress={() => go(1)}>{t("next")}</Button> : null}<Button variant="ghost" onPress={() => onClose(conn !== null)}>{t("close")}</Button></>
    : step === "pick" ? <>{waiting ? <Button variant="primary" isPending={isPending} isDisabled={!pageId} onPress={choose}>{m("pickSave")}</Button> : conn?.pageId ? <Button variant="primary" onPress={() => go(2)}>{t("next")}</Button> : null}{back}</>
    : step === "agent" ? <><Button variant="primary" isPending={isPending} onPress={saveAgents}>{t("next")}</Button>{back}</>
    : <><Button variant="primary" onPress={() => onClose(true)}>{t("done")}</Button>{back}</>

  if (loading) return <Text size="sm" tone="muted" live="polite">{m("working")}</Text>

  return (
    <WizardFrame title={t("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
      {step === "connect" ? (
        <div className={COPY_CLASS}>
          <Text size="sm">{m("connectBody")}</Text>
          <Text size="sm" tone="muted">{m("connectScopes")}</Text>
          <Alert tone="informative" title={m("devNote")} />
        </div>
      ) : null}

      {step === "pick" ? (
        <>
          <Text size="sm">{m("pickBody")}</Text>
          {waiting ? (
            <RadioGroup
              variant="secondary" label={m("pickBody")} isLabelHidden isDisabled={isPending}
              value={pageId || null} onValueChange={setPageId}
              options={(conn?.pages ?? []).map((p) => ({ value: p.id, label: p.name, description: p.igUsername ? m("pickIg", { handle: p.igUsername }) : m("pickNoIg") }))}
            />
          ) : conn?.pageId ? (
            <Alert tone="affirmative" title={m("pickChosen", { page: conn.pageName, ig: conn.igUsername ? ` · @${conn.igUsername}` : "" })} />
          ) : (
            <Text size="sm" tone="muted">{m("pickNone")}</Text>
          )}
        </>
      ) : null}

      {step === "agent" ? (
        <>
          {conn?.pageId ? <Alert tone="affirmative" title={m("pickSaved")} /> : null}
          <Text size="sm" weight="semibold">{t("agentTitleChannel")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} provider="meta" />
        </>
      ) : null}

      {step === "test" && conn ? (
        <>
          <MetaTest connectionId={conn.id} initial={conn.firstEvent} onReceived={() => setReceived(true)} />
          {!received ? <Text size="xs" tone="muted">{m("testSkipNote")}</Text> : null}
        </>
      ) : null}

      {note ? <Alert tone={note.tone} title={note.text} /> : null}
    </WizardFrame>
  )
}
