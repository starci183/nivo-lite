"use client"

import { useEffect, useState, useTransition } from "react"
import { Alert, Badge, Button, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { resumeConnection, saveProviderKeys, setConnectionAgents, startMoneyConnection, updateMoneyConnection, type MoneyProvider, type WizardConnection } from "@/lib/connection-actions"
import { PROVIDERS, type Environment, type GuideContext } from "@/lib/connection-providers"
import { VN_BANKS } from "@/lib/vn-banks"
import { AgentStep, type AgentOption } from "./AgentStep"
import { BUTTONS_CLASS, FIELDS_CLASS } from "./classNames"
import { GuideView } from "./GuideView"
import { VerifyStep } from "./VerifyStep"
import { WizardFrame } from "./WizardFrame"

/** Props for {@link MoneyWizard}. */
export type MoneyWizardProps = {
  readonly provider: MoneyProvider
  /** Continue this unfinished connection instead of creating a new one. */
  readonly resumeId?: string
  readonly agents: ReadonlyArray<AgentOption>
  /** `changed` is true when something was saved, so the list should refresh. */
  readonly onClose: (changed: boolean) => void
}

type Step = "env" | "account" | "follow" | "verify" | "agent"
const STEPS: ReadonlyArray<Step> = ["env", "account", "follow", "verify", "agent"]

/**
 * The guided setup for a bank or payment provider (SePay, payOS, Casso), driven by the provider registry:
 * environment, name and account, "follow along on the provider", the wait for the first real webhook, attach to the agent.
 * The connection is created (pending) when the account step ends, so the URL and key exist for the follow-along step. Everything stays
 * editable afterwards: the earlier steps save on Next, and the follow-along step edits the webhook name and the SePay API key in place.
 */
export const MoneyWizard = ({ provider, resumeId, agents, onClose }: MoneyWizardProps) => {
  const t = useT(connectionWizard)
  const locale = useLocale()
  const def = PROVIDERS[provider]
  const [index, setIndex] = useState(0)
  const [env, setEnv] = useState<Environment>(def.environments[0])
  const [f, setF] = useState({ name: "", bank: "", account: "", holder: "" })
  const [conn, setConnState] = useState<WizardConnection | null>(null)
  const [draft, setDraft] = useState({ webhookName: "", apiKey: "" })
  const [values, setValues] = useState<Record<string, string>>({})
  const [keysSaved, setKeysSaved] = useState(false)
  const [received, setReceived] = useState(false)
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(agents.map((a) => a.id))
  const [note, setNote] = useState<{ tone: "affirmative" | "negative" | "informative"; text: string } | null>(null)
  const [skipped, setSkipped] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(Boolean(resumeId))

  /** Keep the form and the follow-along drafts in step with the stored connection (the account number is never sent back). */
  const setConn = (c: WizardConnection) => {
    setConnState(c)
    setEnv(c.environment)
    setF({ name: c.name, bank: c.bankCode, account: "", holder: c.holder })
    setDraft({ webhookName: webhookNameOf(c.name), apiKey: c.apiKey })
  }

  useEffect(() => {
    if (!resumeId) return
    let stop = false
    void (async () => {
      const r = await resumeConnection(resumeId)
      if (stop) return
      if (r.ok) {
        setConn(r.data)
        setKeysSaved(r.data.credentialsSaved)
        setReceived(Boolean(r.data.firstEvent))
        if (r.data.agentIds.length) setAgentIds(r.data.agentIds)
        setIndex(2)
      } else setNote({ tone: "negative", text: r.error })
      setLoading(false)
    })()
    return () => { stop = true }
  }, [resumeId])

  const step = STEPS[index]
  const names = [t("stepEnv"), t("stepAccount"), t("stepFollow", { brand: def.brand }), t("stepVerify"), t("stepAgent")]
  const ctx: GuideContext = { name: conn?.name ?? f.name, webhookUrl: conn?.webhookUrl ?? "", apiKey: conn?.apiKey ?? "", bank: conn?.bank || bankLabel(f.bank), account: conn?.account || f.account }
  const locked = conn !== null
  const accountDirty = conn !== null && (env !== conn.environment || f.name.trim() !== conn.name || f.bank !== conn.bankCode || f.holder.trim().toUpperCase() !== conn.holder || f.account.trim() !== "")
  const followDirty = conn !== null && (nameOf(draft.webhookName) !== conn.name || (provider === "sepay" && draft.apiKey.trim() !== conn.apiKey))
  const dashboard = def.dashboard[env]
  const needsKeys = def.credentials.length > 0
  const keysFilled = def.credentials.every((k) => (values[k] ?? "").trim().length >= 8)

  const go = (to: number) => { setNote(null); setIndex(to) }
  const fail = (text: string) => setNote({ tone: "negative", text })

  /** Save edits to the existing connection, then move on (and say what to change on the provider too). */
  const save = (name: string, to: number) => {
    if (!conn) return
    startTransition(async () => {
      const r = await updateMoneyConnection(conn.id, {
        environment: env, name, bankCode: f.bank, accountNumber: f.account, holder: f.holder, apiKey: provider === "sepay" ? draft.apiKey : undefined,
      })
      if (!r.ok) return fail(r.error)
      setConn(r.data)
      go(to)
      setNote({ tone: "affirmative", text: t("editSaved", { brand: def.brand }) })
    })
  }

  const create = () => {
    if (locked) return accountDirty ? save(f.name, 2) : go(2)
    startTransition(async () => {
      const r = await startMoneyConnection({ provider, environment: env, name: f.name, bankCode: f.bank, accountNumber: f.account, holder: f.holder })
      if (!r.ok) return fail(r.error)
      setConn(r.data)
      go(2)
    })
  }

  const followDone = () => {
    if (!conn) return
    if (followDirty) return save(nameOf(draft.webhookName), needsKeys ? 2 : 3)
    if (!needsKeys || (keysSaved && !Object.values(values).some(Boolean))) return go(3)
    startTransition(async () => {
      const r = await saveProviderKeys(conn.id, values)
      if (!r.ok) return fail(r.error)
      setKeysSaved(true)
      setValues({})
      if (!r.data.confirmed && def.confirmsWebhook) setNote({ tone: "informative", text: t("payosLocal") })
      else go(3)
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

  const close = () => onClose(conn !== null)

  const footer = (() => {
    const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
    if (step === "env") return <><Button variant="primary" onPress={() => go(1)}>{t("next")}</Button><Button variant="ghost" onPress={close}>{t("close")}</Button></>
    if (step === "account") return <><Button variant="primary" isPending={isPending} isDisabled={!f.name.trim() && !locked} onPress={create}>{t("next")}</Button>{back}</>
    if (step === "follow") {
      const label = needsKeys && !(keysSaved && !Object.values(values).some(Boolean)) ? t("saveKeys") : t("guideDone")
      return <><Button variant="primary" isPending={isPending} isDisabled={needsKeys && !keysFilled && !keysSaved} onPress={followDone}>{label}</Button>{back}</>
    }
    if (step === "verify") {
      return received
        ? <><Button variant="primary" onPress={() => go(4)}>{t("next")}</Button>{back}</>
        : <><Button variant="outline" onPress={() => { setSkipped(true); go(4) }}>{t("skip")}</Button>{back}</>
    }
    return <><Button variant="primary" isPending={isPending} onPress={finish}>{t("done")}</Button>{back}</>
  })()

  if (loading) return <Text size="sm" tone="muted" live="polite">{t("verifyWaiting")}</Text>

  return (
    <WizardFrame title={t("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
      {def.earlyAccess ? <Alert tone="cautionary" title={t("earlyAccess")} description={t("earlyAccessNote")} /> : null}

      {step === "env" ? (
        <>
          {def.environments.includes("test") ? <Text size="sm" tone="muted">{t("envHint")}</Text> : null}
          <RadioGroup variant="secondary"
            label={t("stepEnv")} isLabelHidden isDisabled={isPending} value={env} onValueChange={(v) => setEnv(v === "test" ? "test" : "live")}
            options={def.environments.map((e) => ({ value: e, label: e === "test" ? t("envTest") : t("envLive"), description: e === "test" ? t("envTestBody", { brand: def.brand }) : t("envLiveBody") }))}
          />
          {def.noTestNote ? <Alert tone="informative" title={def.noTestNote[locale]} /> : null}
          {locked ? <Text size="xs" tone="muted">{t("createdLocked")}</Text> : null}
        </>
      ) : null}

      {step === "account" ? (
        <>
          <div className={FIELDS_CLASS}>
            <Input id="w-name" name="name" label={t("fieldName")} variant="secondary" hint={t("fieldNameHint")} isDisabled={isPending} value={f.name} onValueChange={(v) => setF((p) => ({ ...p, name: v }))} />
            {def.needsBank ? (
              <>
                <Select
                  label={t("fieldBank")} variant="secondary" placeholder={t("fieldBankPlaceholder")} isDisabled={isPending} value={f.bank || null}
                  options={VN_BANKS.map((b) => ({ id: b.code, label: `${b.name} (${b.code})` }))} onValueChange={(v) => setF((p) => ({ ...p, bank: v ?? "" }))}
                />
                <Input
                  id="w-account" name="account" label={t("fieldAccount")} variant="secondary" isDisabled={isPending} value={f.account}
                  hint={conn?.account ? t("accountKeep", { account: conn.account }) : undefined} onValueChange={(v) => setF((p) => ({ ...p, account: v }))} />
                <Input id="w-holder" name="holder" label={t("fieldHolder")} variant="secondary" isDisabled={isPending} value={f.holder} onValueChange={(v) => setF((p) => ({ ...p, holder: v }))} />
              </>
            ) : null}
          </div>
          {locked ? <Text size="xs" tone="muted">{t("createdLocked")}</Text> : null}
        </>
      ) : null}

      {step === "follow" && conn ? (
        <>
          <div className={BUTTONS_CLASS}>
            {dashboard ? <Button variant="outline" href={dashboard} target="_blank" rel="noreferrer">{t("openProvider", { brand: def.brand })}</Button> : null}
            {env === "test" ? <Badge tone="neutral">{t("envBadgeTest")}</Badge> : null}
          </div>
          <GuideView
            brand={def.brand} steps={def.guide} ctx={ctx} values={values} onValue={(k, v) => setValues((p) => ({ ...p, [k]: v }))} isDisabled={isPending}
            editable={{
              webhookName: { value: draft.webhookName, onChange: (v) => setDraft((p) => ({ ...p, webhookName: v })) },
              ...(provider === "sepay" ? { apiKey: { value: draft.apiKey, onChange: (v: string) => setDraft((p) => ({ ...p, apiKey: v })) } } : {}),
            }}
          />
          {needsKeys && !keysSaved ? <Text size="xs" tone="muted">{t("keysHint")}</Text> : null}
          {keysSaved && needsKeys ? <Text size="xs" tone="muted" live="polite">{t("keysSaved")}</Text> : null}
        </>
      ) : null}

      {step === "verify" && conn ? (
        <VerifyStep connectionId={conn.id} help={def.verify[env]} ctx={ctx} initial={conn.firstEvent} onReceived={() => setReceived(true)} />
      ) : null}

      {step === "agent" ? (
        <>
          {skipped && !received ? <Alert tone="informative" title={t("skipNote")} /> : null}
          <Text size="sm" weight="semibold">{t("agentTitleAccounting")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} provider={provider} />
        </>
      ) : null}

      {note ? <Alert tone={note.tone} title={note.text} /> : null}
    </WizardFrame>
  )
}

const bankLabel = (code: string): string => VN_BANKS.find((b) => b.code === code)?.name ?? code
/** The webhook name shown on the provider is "NIVO · <connection name>"; editing it edits the connection name. */
const WEBHOOK_PREFIX = "NIVO · "
const webhookNameOf = (name: string): string => `${WEBHOOK_PREFIX}${name}`
const nameOf = (webhookName: string): string => webhookName.trim().replace(/^NIVO\s*·\s*/, "").trim()
