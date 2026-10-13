"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useConnectionsRefresh, useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useOpenApiAuthForm } from "@/hooks/rhf"
import { useQueryLoadOpenApiConnectionSwr } from "@/hooks/swr/api/graphql/queries/useQueryLoadOpenApiConnectionSwr"
import type { OpenApiTestType } from "@/modules/api/graphql/__generated__/schema"
import {
    isOpenApiPullable,
    OPEN_API_EDIT_STEPS,
    OPEN_API_SCHEDULES,
    OPEN_API_STEPS,
    parseOpenApiConfig,
} from "./openapi-wizard.shared"
import type { OpenApiOp, OpenApiPullDef } from "./openapi-wizard.shared"
import { useOpenApiCommands } from "./useOpenApiCommands"

/** What the OpenAPI wizard needs from its drawer. */
interface OpenApiWizardInput {
    /** Continue or edit this existing connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

/** The state machine of the OpenAPI wizard: spec, auth, pulled endpoints, agent tools, schedule, test, agents. */
export const useOpenApiWizard = ({ resumeId, onClose }: OpenApiWizardInput) => {
    const commands = useOpenApiCommands()
    const setConnectionAgents = useSetConnectionAgents()
    const refresh = useConnectionsRefresh()
    const { start: startSync } = useSyncNow()
    const authForm = useOpenApiAuthForm()
    const saved = useQueryLoadOpenApiConnectionSwr(resumeId, { revalidateOnFocus: false, revalidateIfStale: false })
    const editing = Boolean(resumeId)

    const [index, setIndex] = useState(0)
    const [name, setName] = useState("")
    const [specUrl, setSpecUrl] = useState("")
    const [specText, setSpecText] = useState("")
    const [loadedKey, setLoadedKey] = useState<string | null>(null)
    const [ops, setOps] = useState<ReadonlyArray<OpenApiOp>>([])
    const [hasSecret, setHasSecret] = useState(false)
    const [pulls, setPulls] = useState<ReadonlyArray<OpenApiPullDef>>([])
    const [tools, setTools] = useState<ReadonlyArray<string>>([])
    const [schedule, setSchedule] = useState<string>("manual")
    const [testOpId, setTestOpId] = useState<string | null>(null)
    const [testQuery, setTestQuery] = useState("")
    const [testing, setTesting] = useState(false)
    const [result, setResult] = useState<OpenApiTestType | null>(null)
    const [connId, setConnId] = useState<string | null>(resumeId ?? null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState<string | null>(null)
    const [hydrated, setHydrated] = useState(false)
    const [isPending, startTransition] = useTransition()

    const steps = editing ? OPEN_API_EDIT_STEPS : OPEN_API_STEPS
    const step = steps[index] ?? "source"
    const sourceKey = `${specUrl.trim()}|${specText.length}`
    const authType = authForm.watch("authType")

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }

    // Opens a saved connection: its config, then the fresh operations of its spec link when it has one.
    useEffect(() => {
        if (hydrated || !saved.data) return
        setHydrated(true)
        const config = parseOpenApiConfig(saved.data.config)
        setName(saved.data.name)
        setSpecUrl(config.specUrl)
        authForm.reset({
            baseUrl: config.baseUrl,
            authType: config.authType,
            authName: config.authName,
            authValue: "",
            authUser: saved.data.authUser,
            authPassword: "",
        })
        setHasSecret(saved.data.hasSecret)
        setOps(config.ops)
        setPulls(config.pulls)
        setTools(config.tools)
        setSchedule(OPEN_API_SCHEDULES.find((s) => s.minutes === (saved.data?.syncEveryMinutes ?? null))?.id ?? "manual")
        setLoadedKey(`${config.specUrl}|0`)
        if (!config.specUrl) return
        void commands.loadSpec(config.specUrl, "").then((fresh) => {
            if (fresh.kind !== "ok") return
            const keep = new Set([...config.pulls.map((p) => p.opId), ...config.tools])
            setOps([
                ...fresh.value.ops,
                ...config.ops.filter((o) => keep.has(o.id) && !fresh.value.ops.some((f) => f.id === o.id)),
            ])
        })
    }, [hydrated, saved.data, authForm, commands])

    useEffect(() => {
        if (saved.error instanceof Error) setError(saved.error.message)
    }, [saved.error])

    const loadSpec = () =>
        startTransition(async () => {
            setError(null)
            const answer = await commands.loadSpec(specUrl, specText)
            if (answer.kind !== "ok") return setError(answer.message)
            const spec = answer.value
            setOps(spec.ops)
            setLoadedKey(sourceKey)
            if (!authForm.getValues("baseUrl").trim()) authForm.setValue("baseUrl", spec.baseUrl, { shouldValidate: true })
            if (authForm.getValues("authType") === "none" && !hasSecret) {
                authForm.setValue("authType", spec.authType, { shouldValidate: true })
                authForm.setValue("authName", spec.authName, { shouldValidate: true })
            }
            if (!name.trim() && spec.title) setName(spec.title)
            const ids = new Set(spec.ops.map((o) => o.id))
            setPulls((list) => list.filter((x) => ids.has(x.opId)))
            setTools((list) => list.filter((id) => ids.has(id)))
            go(1)
        })

    const onPull = (op: OpenApiOp, pull: OpenApiPullDef | null) =>
        setPulls((list) =>
            pull ? [...list.filter((p) => p.opId !== op.id), pull] : list.filter((p) => p.opId !== op.id),
        )

    const authInput = () => {
        const v = authForm.getValues()
        return { type: v.authType, name: v.authName, value: v.authValue, user: v.authUser, password: v.authPassword }
    }
    const testable = useMemo(() => ops.filter(isOpenApiPullable), [ops])
    const activeTestId = testOpId ?? pulls[0]?.opId ?? testable[0]?.id ?? null
    const testOp = testable.find((o) => o.id === activeTestId) ?? null
    const testPull = pulls.find((p) => p.opId === activeTestId)

    const runTest = async () => {
        if (!testOp) return
        setTesting(true)
        setResult(null)
        const answer = await commands.test({
            connectionId: connId,
            baseUrl: authForm.getValues("baseUrl"),
            auth: authInput(),
            op: testOp,
            fixedQuery: testPull ? testPull.fixedQuery : testQuery,
            itemsPath: testPull?.itemsPath ?? "",
        })
        setTesting(false)
        if (answer.kind !== "ok") return setError(answer.message)
        setError(null)
        setResult(answer.value)
        const found = answer.value
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
            setError(null)
            const keep = new Set([...pulls.map((p) => p.opId), ...tools])
            const values = authForm.getValues()
            const answer = await commands.save({
                connectionId: connId,
                name,
                auth: authInput(),
                syncEveryMinutes: OPEN_API_SCHEDULES.find((s) => s.id === schedule)?.minutes ?? null,
                config: {
                    v: 1,
                    specUrl: specUrl.trim(),
                    baseUrl: values.baseUrl.trim(),
                    authType: values.authType,
                    authName: values.authName.trim(),
                    ops: ops.filter((o) => keep.has(o.id)),
                    pulls,
                    tools,
                },
            })
            if (answer.kind !== "ok") return setError(answer.message)
            setConnId(answer.value)
            if (pulls.length > 0) void startSync(answer.value)
            if (editing) return onClose(true)
            go(index + 1)
        })

    const finish = () =>
        startTransition(async () => {
            if (!connId) return onClose(false)
            const answer = await setConnectionAgents(connId, agentIds)
            if (answer.kind !== "ok") return setError(answer.message)
            await refresh()
            onClose(true)
        })

    return {
        index,
        steps,
        step,
        editing,
        error,
        isPending,
        testing,
        authForm,
        authType,
        hasSecret,
        source: {
            name,
            specUrl,
            specText,
            ready: Boolean(specUrl.trim() || specText.trim()),
            unchanged: loadedKey === sourceKey && ops.length > 0,
        },
        ops,
        pulls,
        tools,
        schedule,
        agentIds,
        authReady: authForm.formState.isValid,
        test: { testable, activeTestId, testOp, testPull, testQuery, result },
        on: {
            go,
            setName,
            setSpecUrl,
            setSpecText,
            loadSpec,
            onPull,
            setTools,
            setSchedule,
            setTestOpId: (id: string | null) => {
                setTestOpId(id)
                setResult(null)
            },
            setTestQuery,
            runTest,
            save,
            finish,
            setAgentIds,
            close: () => onClose(false),
        },
    }
}
