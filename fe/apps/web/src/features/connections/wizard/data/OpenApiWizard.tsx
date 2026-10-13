"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { Alert, Button, Input, Select, Text, Textarea } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { connectorOpenapi } from "@/i18n/dict/connectorOpenapi"
import { useSetConnectionAgents } from "@/hooks/connections"
import { PROVIDERS } from "@/lib/connection-providers"
import {
    getOpenApiForEdit,
    loadOpenApiSpec,
    saveOpenApiConnection,
    testOpenApiOperation,
    type OpenApiTestResult,
} from "@/lib/connectors/openapi-actions"
import { AgentStep } from "../AgentStep"
import { WizardFrame } from "../WizardFrame"
import { COLUMN_CLASS } from "./openapi/classNames"
import { PullsStep, ToolsStep } from "./openapi/PullsStep"
import { isPullable, opLabel, type AuthType, type OpDef, type PullConfig } from "./openapi/spec"
import type { DataWizardProps } from "./types"

const AUTH_TYPES: ReadonlyArray<AuthType> = ["none", "header", "query", "bearer", "basic"]
const SCHEDULES = [
    { id: "manual", minutes: null },
    { id: "15", minutes: 15 },
    { id: "60", minutes: 60 },
    { id: "360", minutes: 360 },
    { id: "1440", minutes: 1440 },
] as const

/** Swagger / OpenAPI in the shared wizard frame: spec, auth, pulled operations, agent tools, schedule, test, agents. */
export const OpenApiWizard = ({ agents, resumeId, onClose }: DataWizardProps) => {
    const setConnectionAgents = useSetConnectionAgents()
    const t = useT(connectorOpenapi)
    const w = useT(connectionWizard)
    const locale = useLocale()
    const def = PROVIDERS.openapi
    const editing = Boolean(resumeId)

    const [index, setIndex] = useState(0)
    const [name, setName] = useState("")
    const [specUrl, setSpecUrl] = useState("")
    const [specText, setSpecText] = useState("")
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const [ops, setOps] = useState<ReadonlyArray<OpDef>>([])
    const [baseUrl, setBaseUrl] = useState("")
    const [authType, setAuthType] = useState<AuthType>("none")
    const [authName, setAuthName] = useState("")
    const [authValue, setAuthValue] = useState("")
    const [authUser, setAuthUser] = useState("")
    const [authPass, setAuthPass] = useState("")
    const [hasSecret, setHasSecret] = useState(false)
    const [pulls, setPulls] = useState<ReadonlyArray<PullConfig>>([])
    const [tools, setTools] = useState<ReadonlyArray<string>>([])
    const [schedule, setSchedule] = useState<string>("manual")
    const [testOpId, setTestOpId] = useState<string | null>(null)
    const [testQuery, setTestQuery] = useState("")
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<OpenApiTestResult | null>(null)
    const [connId, setConnId] = useState<string | null>(resumeId ?? null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const steps: ReadonlyArray<"source" | "auth" | "pulls" | "tools" | "schedule" | "test" | "agent"> = editing
        ? ["source", "auth", "pulls", "tools", "schedule", "test"]
        : ["source", "auth", "pulls", "tools", "schedule", "test", "agent"]
    const step = steps[index]
    const names = steps.map((s) => t(`step_${s}`))
    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }
    const sourceKey = `${specUrl.trim()}|${specText.length}`

    useEffect(() => {
        if (!resumeId) return
        void (async () => {
            const r = await getOpenApiForEdit(resumeId)
            if (!r.ok) return setError(r.error)
            const c = r.data.config
            setName(r.data.name)
            setSpecUrl(c.specUrl)
            setBaseUrl(c.baseUrl)
            setAuthType(c.authType)
            setAuthName(c.authName)
            setAuthUser(r.data.authUser)
            setHasSecret(r.data.hasSecret)
            setOps(c.ops)
            setPulls(c.pulls)
            setTools(c.tools)
            setSchedule(SCHEDULES.find((s) => s.minutes === r.data.syncEveryMinutes)?.id ?? "manual")
            if (c.specUrl) {
                const fresh = await loadOpenApiSpec({ specUrl: c.specUrl, specText: "" })
                if (fresh.ok) {
                    const keep = new Set([...c.pulls.map((p) => p.opId), ...c.tools])
                    setOps([
                        ...fresh.data.ops,
                        ...c.ops.filter((o) => keep.has(o.id) && !fresh.data.ops.some((f) => f.id === o.id)),
                    ])
                }
            }
            setLoadedKey(`${c.specUrl}|0`)
        })()
    }, [resumeId])

    const loadSpec = () =>
        startTransition(async () => {
            setError(null)
            const r = await loadOpenApiSpec({ specUrl, specText })
            if (!r.ok) return setError(r.error)
            const d = r.data
            setOps(d.ops)
            setLoadedKey(sourceKey)
            if (!baseUrl.trim()) setBaseUrl(d.baseUrl)
            if (authType === "none" && !hasSecret) {
                setAuthType(d.authHint.type)
                setAuthName(d.authHint.name)
            }
            if (!name.trim() && d.title) setName(d.title)
            const ids = new Set(d.ops.map((o) => o.id))
            setPulls((p) => p.filter((x) => ids.has(x.opId)))
            setTools((x) => x.filter((id) => ids.has(id)))
            go(1)
        })

    const onPull = (op: OpDef, pull: PullConfig | null) =>
        setPulls((list) =>
            pull ? [...list.filter((p) => p.opId !== op.id), pull] : list.filter((p) => p.opId !== op.id),
        )

    const authInput = { type: authType, name: authName, value: authValue, user: authUser, password: authPass }
    const testable = useMemo(() => ops.filter(isPullable), [ops])
    const activeTestId = testOpId ?? pulls[0]?.opId ?? testable[0]?.id ?? null
    const testOp = testable.find((o) => o.id === activeTestId) ?? null
    const testPull = pulls.find((p) => p.opId === activeTestId)

    const runTest = async () => {
        if (!testOp) return
        setTesting(true)
        setResult(null)
        const r = await testOpenApiOperation({
            connectionId: connId ?? undefined,
            baseUrl,
            auth: authInput,
            op: testOp,
            fixedQuery: testPull ? testPull.fixedQuery : testQuery,
            itemsPath: testPull?.itemsPath ?? "",
        })
        setTesting(false)
        if (!r.ok) return setError(r.error)
        setError(null)
        setResult(r.data)
        const found = r.data
        if (testPull && found.itemCount > 0) {
            onPull(testOp, {
                ...testPull,
                itemsPath: testPull.itemsPath || found.itemsPath,
                idField: testPull.idField || found.idField,
                titleField: testPull.titleField || found.titleField,
            })
        }
    }

    const save = () =>
        startTransition(async () => {
            const keep = new Set([...pulls.map((p) => p.opId), ...tools])
            const r = await saveOpenApiConnection({
                connectionId: connId ?? undefined,
                name,
                auth: authInput,
                syncEveryMinutes: SCHEDULES.find((s) => s.id === schedule)?.minutes ?? null,
                config: {
                    v: 1,
                    specUrl: specUrl.trim(),
                    baseUrl: baseUrl.trim(),
                    authType,
                    authName: authName.trim(),
                    ops: ops.filter((o) => keep.has(o.id)),
                    pulls,
                    tools,
                },
            })
            if (!r.ok) return setError(r.error)
            setConnId(r.data.id)
            if (editing) return onClose(true)
            go(index + 1)
        })

    const finish = () =>
        startTransition(async () => {
            if (!connId) return onClose(false)
            const r = await setConnectionAgents(connId, agentIds)
            if (r.kind !== "ok") return setError(r.message)
            onClose(true)
        })

    const sourceReady = Boolean(specUrl.trim() || specText.trim())
    const sourceUnchanged = loadedKey === sourceKey && ops.length > 0
    const authReady =
        /^https?:\/\//i.test(baseUrl.trim()) &&
        (authType === "none" || (authType === "header" || authType === "query" ? Boolean(authName.trim()) : true))
    const back = (
        <Button variant="outline" isDisabled={isPending || testing} onPress={() => go(index - 1)}>
            {w("back")}
        </Button>
    )
    const next = (disabled = false) => (
        <Button variant="primary" isDisabled={disabled || isPending} onPress={() => go(index + 1)}>
            {w("next")}
        </Button>
    )

    const footer =
        step === "source" ? (
            <>
                <Button
                    variant="primary"
                    isPending={isPending}
                    isDisabled={!sourceReady}
                    onPress={sourceUnchanged ? () => go(1) : loadSpec}
                >
                    {sourceUnchanged ? w("next") : t("loadSpec")}
                </Button>
                <Button variant="ghost" onPress={() => onClose(false)}>
                    {w("close")}
                </Button>
            </>
        ) : step === "auth" ? (
            <>
                {next(!authReady)}
                {back}
            </>
        ) : step === "pulls" || step === "tools" || step === "schedule" ? (
            <>
                {next()}
                {back}
            </>
        ) : step === "test" ? (
            <>
                <Button variant="primary" isPending={isPending} isDisabled={testing || !name.trim()} onPress={save}>
                    {editing ? w("done") : t("saveAndContinue")}
                </Button>
                <Button
                    variant="outline"
                    isPending={testing}
                    isDisabled={isPending || !testOp || !authReady}
                    onPress={() => void runTest()}
                >
                    {t("testButton")}
                </Button>
                {back}
            </>
        ) : (
            <Button variant="primary" isPending={isPending} onPress={finish}>
                {w("done")}
            </Button>
        )

    return (
        <WizardFrame title={w("title", { provider: def.title[locale] })} steps={names} index={index} footer={footer}>
            {step === "source" ? (
                <div className={COLUMN_CLASS}>
                    <Input
                        id="oa-name"
                        name="name"
                        label={t("fieldName")}
                        variant="secondary"
                        hint={t("fieldNameHint")}
                        isDisabled={isPending}
                        value={name}
                        onValueChange={setName}
                    />
                    <Input
                        id="oa-url"
                        name="specUrl"
                        label={t("fieldSpecUrl")}
                        variant="secondary"
                        hint={t("fieldSpecUrlHint")}
                        isDisabled={isPending}
                        value={specUrl}
                        onValueChange={setSpecUrl}
                    />
                    <Textarea
                        id="oa-text"
                        label={t("fieldSpecText")}
                        variant="secondary"
                        description={t("fieldSpecTextHint")}
                        rows={6}
                        isDisabled={isPending}
                        value={specText}
                        onValueChange={setSpecText}
                    />
                </div>
            ) : null}
            {step === "auth" ? (
                <div className={COLUMN_CLASS}>
                    <Input
                        id="oa-base"
                        name="baseUrl"
                        label={t("fieldBaseUrl")}
                        variant="secondary"
                        hint={t("fieldBaseUrlHint")}
                        isDisabled={isPending}
                        value={baseUrl}
                        onValueChange={setBaseUrl}
                    />
                    <Select
                        label={t("fieldAuth")}
                        variant="secondary"
                        options={AUTH_TYPES.map((a) => ({ id: a, label: t(`auth_${a}`) }))}
                        value={authType}
                        onValueChange={(v) => v && setAuthType(v as AuthType)}
                    />
                    {authType === "header" || authType === "query" ? (
                        <Input
                            id="oa-auth-name"
                            name="authName"
                            label={authType === "header" ? t("fieldHeaderName") : t("fieldQueryName")}
                            variant="secondary"
                            isDisabled={isPending}
                            value={authName}
                            onValueChange={setAuthName}
                        />
                    ) : null}
                    {authType === "header" || authType === "query" || authType === "bearer" ? (
                        <Input
                            id="oa-auth-value"
                            name="authValue"
                            label={authType === "bearer" ? t("fieldToken") : t("fieldKeyValue")}
                            variant="secondary"
                            kind="password"
                            hint={hasSecret ? t("keepSecretHint") : undefined}
                            isDisabled={isPending}
                            value={authValue}
                            onValueChange={setAuthValue}
                        />
                    ) : null}
                    {authType === "basic" ? (
                        <>
                            <Input
                                id="oa-auth-user"
                                name="authUser"
                                label={t("fieldUser")}
                                variant="secondary"
                                isDisabled={isPending}
                                value={authUser}
                                onValueChange={setAuthUser}
                            />
                            <Input
                                id="oa-auth-pass"
                                name="authPass"
                                label={t("fieldPassword")}
                                variant="secondary"
                                kind="password"
                                hint={hasSecret ? t("keepSecretHint") : undefined}
                                isDisabled={isPending}
                                value={authPass}
                                onValueChange={setAuthPass}
                            />
                        </>
                    ) : null}
                </div>
            ) : null}
            {step === "pulls" ? <PullsStep ops={ops} pulls={pulls} onPull={onPull} isDisabled={isPending} /> : null}
            {step === "tools" ? <ToolsStep ops={ops} tools={tools} onTools={setTools} isDisabled={isPending} /> : null}
            {step === "schedule" ? (
                <div className={COLUMN_CLASS}>
                    <Text size="sm" tone="muted">
                        {pulls.length ? t("scheduleHint") : t("scheduleNone")}
                    </Text>
                    <Select
                        label={t("fieldSchedule")}
                        variant="secondary"
                        isDisabled={pulls.length === 0}
                        options={SCHEDULES.map((s) => ({ id: s.id, label: t(`schedule_${s.id}`) }))}
                        value={schedule}
                        onValueChange={(v) => v && setSchedule(v)}
                    />
                </div>
            ) : null}
            {step === "test" ? (
                <div className={COLUMN_CLASS}>
                    <Text size="sm" tone="muted">
                        {t("testHint")}
                    </Text>
                    {testable.length === 0 ? (
                        <Text size="sm">{t("noGets")}</Text>
                    ) : (
                        <Select
                            label={t("fieldTestOp")}
                            variant="secondary"
                            options={testable.map((o) => ({ id: o.id, label: opLabel(o) }))}
                            value={activeTestId}
                            onValueChange={(v) => {
                                setTestOpId(v)
                                setResult(null)
                            }}
                        />
                    )}
                    {testOp && !testPull ? (
                        <Input
                            id="oa-test-q"
                            name="testQuery"
                            label={t("fixedQuery")}
                            variant="secondary"
                            value={testQuery}
                            onValueChange={setTestQuery}
                        />
                    ) : null}
                    {testing ? (
                        <Text size="sm" live="polite">
                            {t("testing")}
                        </Text>
                    ) : null}
                    {result ? (
                        result.error ? (
                            <Alert tone="negative" title={result.error} />
                        ) : (
                            <Alert
                                tone={result.itemCount > 0 ? "affirmative" : "informative"}
                                title={t("testOk", { status: result.status, n: result.itemCount })}
                            />
                        )
                    ) : null}
                    {result && !result.error && result.sampleKeys.length ? (
                        <Text size="sm" tone="muted">
                            {t("testFields", { fields: result.sampleKeys.join(", ") })}
                        </Text>
                    ) : null}
                </div>
            ) : null}
            {step === "agent" ? (
                <>
                    <Text size="sm" weight="semibold">
                        {t("agentTitle")}
                    </Text>
                    <AgentStep agents={agents} value={agentIds} onValue={setAgentIds} isDisabled={isPending} />
                </>
            ) : null}
            {error ? <Alert tone="negative" title={error} /> : null}
        </WizardFrame>
    )
}
