"use client"

import { useState, useTransition } from "react"
import { Alert, Button, CheckboxGroup, Input, RadioGroup, Select, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connectorDatabase } from "@/i18n/dict/connectorDatabase"
import { useSetConnectionAgents } from "@/hooks/connections"
import {
    DB_DEFAULT_PORT,
    DB_ENGINES,
    DB_MAX_COLUMNS,
    DB_MAX_ROWS,
    DB_SCHEDULES,
    dbDefaultMapping,
    dbEngineOf,
    dbTableKey,
    useDatabaseCommands,
} from "@/hooks/database-wizard"
import { useDatabaseTargetForm } from "@/hooks/rhf"
import type { DbEngine, DbSavedConnection, DbTableInfo, DbTableMapping, DbTarget } from "@/modules/types"
import { AgentStep } from "../../AgentStep"
import { FIELDS_CLASS } from "../../classNames"
import { WizardFrame } from "../../WizardFrame"
import { TableMapper } from "./TableMapper"
import type { DataWizardProps } from "../types"

type Step = "connect" | "tables" | "schedule" | "agent"
const STEPS: ReadonlyArray<Step> = ["connect", "tables", "schedule", "agent"]
/** Props of {@link DatabaseSetup}: the wizard props plus the saved connection once loaded. */
export type DatabaseSetupProps = DataWizardProps & {
    readonly saved: DbSavedConnection | null
    readonly loadError?: string
}

type TextField = "name" | "host" | "port" | "database" | "user" | "password"
type Note = { readonly tone: "affirmative" | "negative" | "informative"; readonly text: string }

/**
 * Setup of a business database connection (owner only): connect and list tables, map the tables, schedule, agents.
 * The password lives in this component's form only until it is saved (encrypted on the server); when editing, it is never sent back.
 */
export const DatabaseSetup = ({ agents, resumeId, onClose, saved, loadError }: DatabaseSetupProps) => {
    const setConnectionAgents = useSetConnectionAgents()
    const commands = useDatabaseCommands()
    const t = useT(connectorDatabase)
    const [index, setIndex] = useState(0)
    const [passwordKept, setPasswordKept] = useState(false)
    const passwordSaved = passwordKept || Boolean(saved?.hasPassword)
    const form = useDatabaseTargetForm(passwordSaved, saved)
    const values = form.watch()
    const [connId, setConnId] = useState<string | undefined>(resumeId)
    const [tables, setTables] = useState<ReadonlyArray<DbTableInfo> | null>(null)
    const [picked, setPicked] = useState<ReadonlyArray<DbTableMapping>>(saved?.tables ?? [])
    const [everyMinutes, setEveryMinutes] = useState<number | null>(saved === null ? 60 : saved.everyMinutes)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>(saved?.agentIds ?? [])
    const [note, setNote] = useState<Note | null>(loadError === undefined ? null : { tone: "negative", text: loadError })
    const [isPending, startTransition] = useTransition()

    const step = STEPS[index]
    const names = [t("stepConnect"), t("stepTables"), t("stepSchedule"), t("stepAgent")]
    const go = (to: number) => {
        setNote(null)
        setIndex(to)
    }
    const fail = (text: string) => setNote({ tone: "negative", text })
    const touched = () => setTables(null)
    const change = (field: TextField, value: string) => {
        form.setValue(field, value, { shouldValidate: true, shouldDirty: true })
        touched()
    }
    const typed = (): DbTarget => ({
        engine: values.engine,
        host: values.host.trim(),
        port: Number(values.port),
        database: values.database.trim(),
        user: values.user.trim(),
        password: values.password,
        ssl: values.ssl,
    })
    const canTest = form.formState.isValid

    const setEngine = (e: DbEngine) => {
        if (values.port === String(DB_DEFAULT_PORT[values.engine])) form.setValue("port", String(DB_DEFAULT_PORT[e]))
        form.setValue("engine", e, { shouldValidate: true, shouldDirty: true })
        touched()
    }

    const test = () => {
        setNote(null)
        startTransition(async () => {
            const r = await commands.test(connId, typed())
            if (r.kind !== "ok") return fail(r.message)
            setTables(r.value)
            // Keep the saved mapping for tables that still exist.
            setPicked((p) => p.filter((m) => r.value.some((x) => x.schema === m.schema && x.name === m.table)))
            setNote({ tone: "affirmative", text: t("testOk", { count: r.value.length }) })
        })
    }

    const toggle = (keys: ReadonlyArray<string>) => {
        if (!tables) return
        setPicked(
            keys.flatMap((k) => {
                const have = picked.find((m) => dbTableKey(m) === k)
                if (have) return [have]
                const info = tables.find((x) => dbTableKey(x) === k)
                return info ? [dbDefaultMapping(info)] : []
            }),
        )
    }
    const replace = (next: DbTableMapping) =>
        setPicked((p) => p.map((m) => (dbTableKey(m) === dbTableKey(next) ? next : m)))

    const tablesReady = picked.length > 0 && picked.every((m) => m.idColumn)

    const save = () => {
        startTransition(async () => {
            const r = await commands.save({
                connectionId: connId,
                name: values.name,
                target: typed(),
                tables: picked,
                everyMinutes,
            })
            if (r.kind !== "ok") return fail(r.message)
            setConnId(r.value)
            setPasswordKept(true)
            form.setValue("password", "", { shouldValidate: true })
            go(3)
        })
    }

    const finish = () => {
        if (!connId) return onClose(false)
        startTransition(async () => {
            const r = await setConnectionAgents(connId, agentIds)
            if (r.kind !== "ok") return fail(r.message)
            onClose(true)
        })
    }

    const back = (
        <Button variant="outline" isDisabled={isPending} onPress={() => go(index - 1)}>
            {t("back")}
        </Button>
    )
    const footer = (() => {
        if (step === "connect") {
            return (
                <>
                    <Button
                        variant="primary"
                        isPending={isPending}
                        isDisabled={!canTest}
                        onPress={tables ? () => go(1) : test}
                    >
                        {tables ? t("next") : t("test")}
                    </Button>
                    {tables ? (
                        <Button variant="outline" isPending={isPending} isDisabled={!canTest} onPress={test}>
                            {t("test")}
                        </Button>
                    ) : null}
                    <Button variant="ghost" onPress={() => onClose(connId !== undefined && connId !== resumeId)}>
                        {t("close")}
                    </Button>
                </>
            )
        }
        if (step === "tables")
            return (
                <>
                    <Button variant="primary" isDisabled={!tablesReady} onPress={() => go(2)}>
                        {t("next")}
                    </Button>
                    {back}
                </>
            )
        if (step === "schedule")
            return (
                <>
                    <Button variant="primary" isPending={isPending} onPress={save}>
                        {t("save")}
                    </Button>
                    {back}
                </>
            )
        return (
            <>
                <Button variant="primary" isPending={isPending} onPress={finish}>
                    {t("done")}
                </Button>
                <Button variant="ghost" isDisabled={isPending} onPress={() => go(2)}>
                    {t("back")}
                </Button>
            </>
        )
    })()

    return (
        <WizardFrame title={t("title")} steps={names} index={index} footer={footer}>
            {step === "connect" ? (
                <>
                    <Alert tone="informative" title={t("readOnlyTitle")} description={t("readOnlyBody")} />
                    <div className={FIELDS_CLASS}>
                        <Input
                            id="db-name"
                            name="name"
                            label={t("fieldName")}
                            variant="secondary"
                            hint={t("fieldNameHint")}
                            isDisabled={isPending}
                            value={values.name}
                            onValueChange={(v) => change("name", v)}
                        />
                        <Select
                            label={t("fieldEngine")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.engine}
                            options={DB_ENGINES.map((e) => ({ id: e, label: t(`engine_${e}`) }))}
                            onValueChange={(v) => setEngine(dbEngineOf(v ?? "") ?? "postgres")}
                        />
                        <Input
                            id="db-host"
                            name="host"
                            label={t("fieldHost")}
                            variant="secondary"
                            hint={t("fieldHostHint")}
                            isDisabled={isPending}
                            value={values.host}
                            onValueChange={(v) => change("host", v)}
                        />
                        <Input
                            id="db-port"
                            name="port"
                            label={t("fieldPort")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.port}
                            onValueChange={(v) => change("port", v.replace(/\D/g, "").slice(0, 5))}
                        />
                        <Input
                            id="db-database"
                            name="database"
                            label={t("fieldDatabase")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.database}
                            onValueChange={(v) => change("database", v)}
                        />
                        <Input
                            id="db-user"
                            name="user"
                            label={t("fieldUser")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.user}
                            onValueChange={(v) => change("user", v)}
                        />
                        <Input
                            id="db-password"
                            name="password"
                            kind="password"
                            label={t("fieldPassword")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={values.password}
                            hint={passwordSaved && !values.password ? t("passwordSaved") : undefined}
                            onValueChange={(v) => change("password", v)}
                        />
                    </div>
                    <RadioGroup
                        variant="secondary"
                        label={t("fieldSsl")}
                        isDisabled={isPending}
                        value={values.ssl ? "on" : "off"}
                        onValueChange={(v) => {
                            form.setValue("ssl", v !== "off", { shouldValidate: true, shouldDirty: true })
                            touched()
                        }}
                        options={[
                            { value: "on", label: t("sslRequire") },
                            { value: "off", label: t("sslOff") },
                        ]}
                    />
                </>
            ) : null}

            {step === "tables" && tables ? (
                <>
                    <Text size="sm" tone="muted">
                        {t("tablesHint", { max: DB_MAX_COLUMNS })}
                    </Text>
                    <CheckboxGroup
                        variant="secondary"
                        label={t("tablesFound")}
                        isDisabled={isPending}
                        options={tables.map((x) => ({
                            value: dbTableKey(x),
                            label: `${dbTableKey(x)} (${x.columns.length})`,
                        }))}
                        value={picked.map(dbTableKey)}
                        onValueChange={toggle}
                    />
                    {picked.length === 0 ? (
                        <Text size="xs" tone="muted">
                            {t("tablesNone")}
                        </Text>
                    ) : null}
                    {picked.map((m) => {
                        const info = tables.find((x) => x.schema === m.schema && x.name === m.table)
                        return info ? (
                            <TableMapper
                                key={dbTableKey(m)}
                                table={info}
                                mapping={m}
                                onChange={replace}
                                connectionId={connId}
                                target={typed()}
                                isDisabled={isPending}
                            />
                        ) : null
                    })}
                    <Text size="xs" tone="muted">
                        {t("limitNote", { rows: DB_MAX_ROWS })}
                    </Text>
                </>
            ) : null}

            {step === "schedule" ? (
                <>
                    <Text size="sm" tone="muted">
                        {t("scheduleHint")}
                    </Text>
                    <RadioGroup
                        variant="secondary"
                        label={t("scheduleLabel")}
                        isLabelHidden
                        isDisabled={isPending}
                        value={String(everyMinutes ?? "manual")}
                        onValueChange={(v) => setEveryMinutes(DB_SCHEDULES.find((s) => s.key === v)?.minutes ?? null)}
                        options={DB_SCHEDULES.map((s) => ({
                            value: s.key,
                            label: t(`every_${s.key}` as "every_manual"),
                        }))}
                    />
                </>
            ) : null}

            {step === "agent" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("agentTitle")}
                    </Text>
                    <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
                </>
            ) : null}

            {note ? <Alert tone={note.tone} title={note.text} /> : null}
        </WizardFrame>
    )
}
