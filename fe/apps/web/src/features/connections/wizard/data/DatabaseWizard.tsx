"use client"

import { useEffect, useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorDatabase } from "@/i18n/dict/connectorDatabase"
import { setConnectionAgents } from "@/lib/connection-actions"
import { loadDatabaseConnection, saveDatabaseConnection, testDatabase } from "@/lib/connectors/database-actions"
import { AgentStep } from "../AgentStep"
import { FIELDS_CLASS } from "../classNames"
import { WizardFrame } from "../WizardFrame"
import { TableMapper } from "./database/TableMapper"
import {
  DEFAULT_PORT, ENGINES, ENGINE_LABEL, MAX_COLUMNS, MAX_ROWS, tableKey,
  type DbTarget, type Engine, type TableInfo, type TableMapping,
} from "./database/types"
import type { DataWizardProps } from "./types"

type Step = "connect" | "tables" | "schedule" | "agent"
const STEPS: ReadonlyArray<Step> = ["connect", "tables", "schedule", "agent"]
const SCHEDULES: ReadonlyArray<{ readonly key: string; readonly minutes: number | null }> = [
  { key: "manual", minutes: null }, { key: "15", minutes: 15 }, { key: "60", minutes: 60 }, { key: "360", minutes: 360 }, { key: "1440", minutes: 1440 },
]
type Note = { readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }

const guessColumn = (table: TableInfo, names: ReadonlyArray<string>): string =>
  table.columns.find((c) => names.includes(c.name.toLowerCase()))?.name ?? ""

/** A starting mapping for a table the owner just ticked: id / title / updated-at guessed from common names, first columns selected. */
const defaultMapping = (table: TableInfo): TableMapping => ({
  schema: table.schema, table: table.name, entity: "other",
  idColumn: guessColumn(table, ["id", "uuid", "code"]) || (table.columns[0]?.name ?? ""),
  titleColumn: guessColumn(table, ["name", "title", "full_name", "fullname", "email", "ten"]),
  updatedColumn: guessColumn(table, ["updated_at", "updatedat", "modified_at", "last_modified", "updated"]),
  columns: table.columns.slice(0, MAX_COLUMNS).map((c) => c.name),
})

/**
 * Setup of a business database connection (owner only): connect and list tables, map the tables, schedule, agents.
 * The password lives in this component's state only until it is saved (encrypted on the server); when editing, it is never sent back.
 */
export const DatabaseWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
  const t = useT(connectorDatabase)
  const [index, setIndex] = useState(0)
  const [name, setName] = useState("")
  const [target, setTarget] = useState<DbTarget>({ engine: "postgres", host: "", port: DEFAULT_PORT.postgres, database: "", user: "", password: "", ssl: true })
  const [portText, setPortText] = useState(String(DEFAULT_PORT.postgres))
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [connId, setConnId] = useState<string | undefined>(resumeId)
  const [tables, setTables] = useState<ReadonlyArray<TableInfo> | null>(null)
  const [picked, setPicked] = useState<ReadonlyArray<TableMapping>>([])
  const [everyMinutes, setEveryMinutes] = useState<number | null>(60)
  const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
  const [note, setNote] = useState<Note | null>(null)
  const [isPending, startTransition] = useTransition()
  const [loading, setLoading] = useState(Boolean(resumeId))

  useEffect(() => {
    if (!resumeId) return
    let stop = false
    void (async () => {
      const r = await loadDatabaseConnection(resumeId)
      if (stop) return
      if (r.ok) {
        setName(r.data.name)
        setTarget({ ...r.data.target, password: "" })
        setPortText(String(r.data.target.port))
        setPasswordSaved(r.data.hasPassword)
        setPicked(r.data.tables)
        setEveryMinutes(r.data.everyMinutes)
        setAgentIds(r.data.agentIds)
      } else setNote({ tone: "negative", text: r.error })
      setLoading(false)
    })()
    return () => { stop = true }
  }, [resumeId])

  const step = STEPS[index]
  const names = [t("stepConnect"), t("stepTables"), t("stepSchedule"), t("stepAgent")]
  const go = (to: number) => { setNote(null); setIndex(to) }
  const fail = (text: string) => setNote({ tone: "negative", text })
  const patch = (p: Partial<DbTarget>) => { setTarget((v) => ({ ...v, ...p })); setTables(null) }
  const typed = (): DbTarget => ({ ...target, port: Number(portText) })
  const canTest = name.trim() && target.host.trim() && target.database.trim() && target.user.trim() && Number(portText) > 0 && (target.password || passwordSaved)

  const setEngine = (e: Engine) => {
    if (portText === String(DEFAULT_PORT[target.engine])) setPortText(String(DEFAULT_PORT[e]))
    patch({ engine: e })
  }

  const test = () => {
    setNote(null)
    startTransition(async () => {
      const r = await testDatabase({ connectionId: connId, target: typed() })
      if (!r.ok) return fail(r.error)
      setTables(r.data.tables)
      // Keep the saved mapping for tables that still exist.
      setPicked((p) => p.filter((m) => r.data.tables.some((x) => x.schema === m.schema && x.name === m.table)))
      setNote({ tone: "affirmative", text: t("testOk", { count: r.data.tables.length }) })
    })
  }

  const toggle = (keys: ReadonlyArray<string>) => {
    if (!tables) return
    setPicked(keys.flatMap((k) => {
      const have = picked.find((m) => tableKey(m) === k)
      if (have) return [have]
      const info = tables.find((x) => tableKey(x) === k)
      return info ? [defaultMapping(info)] : []
    }))
  }
  const replace = (next: TableMapping) => setPicked((p) => p.map((m) => (tableKey(m) === tableKey(next) ? next : m)))

  const tablesReady = picked.length > 0 && picked.every((m) => m.idColumn)

  const save = () => {
    startTransition(async () => {
      const r = await saveDatabaseConnection({ connectionId: connId, name, target: typed(), tables: picked, everyMinutes })
      if (!r.ok) return fail(r.error)
      setConnId(r.data.id)
      setPasswordSaved(true)
      setTarget((v) => ({ ...v, password: "" }))
      go(3)
    })
  }

  const finish = () => {
    if (!connId) return onClose(false)
    startTransition(async () => {
      const r = await setConnectionAgents(connId, agentIds)
      if (!r.ok) return fail(r.error)
      onClose(true)
    })
  }

  const back = <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>{t("back")}</Button>
  const footer = (() => {
    if (step === "connect") {
      return (
        <>
          <Button variant="primary" isPending={isPending} isDisabled={!canTest} onPress={tables ? () => go(1) : test}>{tables ? t("next") : t("test")}</Button>
          {tables ? <Button variant="outline" isPending={isPending} isDisabled={!canTest} onPress={test}>{t("test")}</Button> : null}
          <Button variant="ghost" onPress={() => onClose(connId !== undefined && connId !== resumeId)}>{t("close")}</Button>
        </>
      )
    }
    if (step === "tables") return <><Button variant="primary" isDisabled={!tablesReady} onPress={() => go(2)}>{t("next")}</Button>{back}</>
    if (step === "schedule") return <><Button variant="primary" isPending={isPending} onPress={save}>{t("save")}</Button>{back}</>
    return <><Button variant="primary" isPending={isPending} onPress={finish}>{t("done")}</Button><Button variant="ghost" isDisabled={isPending} onPress={() => go(2)}>{t("back")}</Button></>
  })()

  if (loading) return <Text size="sm" tone="muted" live="polite">{t("loading")}</Text>

  return (
    <WizardFrame title={t("title")} steps={names} index={index} footer={footer}>
      {step === "connect" ? (
        <>
          <Alert tone="informative" title={t("readOnlyTitle")} description={t("readOnlyBody")} />
          <div className={FIELDS_CLASS}>
            <Input id="db-name" name="name" label={t("fieldName")} variant="secondary" hint={t("fieldNameHint")} isDisabled={isPending} value={name} onValueChange={setName} />
            <Select
              label={t("fieldEngine")} variant="secondary" isDisabled={isPending} value={target.engine}
              options={ENGINES.map((e) => ({ id: e, label: ENGINE_LABEL[e] }))} onValueChange={(v) => setEngine(ENGINES.find((e) => e === v) ?? "postgres")}
            />
            <Input id="db-host" name="host" label={t("fieldHost")} variant="secondary" hint={t("fieldHostHint")} isDisabled={isPending} value={target.host} onValueChange={(v) => patch({ host: v })} />
            <Input id="db-port" name="port" label={t("fieldPort")} variant="secondary" isDisabled={isPending} value={portText} onValueChange={(v) => { setPortText(v.replace(/\D/g, "").slice(0, 5)); setTables(null) }} />
            <Input id="db-database" name="database" label={t("fieldDatabase")} variant="secondary" isDisabled={isPending} value={target.database} onValueChange={(v) => patch({ database: v })} />
            <Input id="db-user" name="user" label={t("fieldUser")} variant="secondary" isDisabled={isPending} value={target.user} onValueChange={(v) => patch({ user: v })} />
            <Input
              id="db-password" name="password" kind="password" label={t("fieldPassword")} variant="secondary" isDisabled={isPending} value={target.password}
              hint={passwordSaved && !target.password ? t("passwordSaved") : undefined} onValueChange={(v) => patch({ password: v })}
            />
          </div>
          <RadioGroup
            variant="secondary" label={t("fieldSsl")} isDisabled={isPending} value={target.ssl ? "on" : "off"} onValueChange={(v) => patch({ ssl: v !== "off" })}
            options={[{ value: "on", label: t("sslRequire") }, { value: "off", label: t("sslOff") }]}
          />
        </>
      ) : null}

      {step === "tables" && tables ? (
        <>
          <Text size="sm" tone="muted">{t("tablesHint", { max: MAX_COLUMNS })}</Text>
          <CheckboxGroup
            variant="secondary" label={t("tablesFound")} isDisabled={isPending}
            options={tables.map((x) => ({ value: tableKey(x), label: `${tableKey(x)} (${x.columns.length})` }))} value={picked.map(tableKey)} onValueChange={toggle}
          />
          {picked.length === 0 ? <Text size="xs" tone="muted">{t("tablesNone")}</Text> : null}
          {picked.map((m) => {
            const info = tables.find((x) => x.schema === m.schema && x.name === m.table)
            return info ? <TableMapper key={tableKey(m)} table={info} mapping={m} onChange={replace} connectionId={connId} target={typed()} isDisabled={isPending} /> : null
          })}
          <Text size="xs" tone="muted">{t("limitNote", { rows: MAX_ROWS })}</Text>
        </>
      ) : null}

      {step === "schedule" ? (
        <>
          <Text size="sm" tone="muted">{t("scheduleHint")}</Text>
          <RadioGroup
            variant="secondary" label={t("scheduleLabel")} isLabelHidden isDisabled={isPending}
            value={String(everyMinutes ?? "manual")} onValueChange={(v) => setEveryMinutes(SCHEDULES.find((s) => s.key === v)?.minutes ?? null)}
            options={SCHEDULES.map((s) => ({ value: s.key, label: t(`every_${s.key}` as "every_manual") }))}
          />
        </>
      ) : null}

      {step === "agent" ? (
        <>
          <Text size="sm" weight="semibold">{t("agentTitle")}</Text>
          <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
        </>
      ) : null}

      {note ? <Alert tone={note.tone} title={note.text} /> : null}
    </WizardFrame>
  )
}
