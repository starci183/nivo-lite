"use client"

import { useRef, useState, useTransition } from "react"
import { useConnectionsRefresh, useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useOpenApiAuthForm } from "@/hooks/rhf"
import { useQueryLoadOpenApiConnectionSwr } from "@/hooks/swr"
import {
    EMPTY_OPEN_API_DRAFT,
    OPEN_API_EDIT_STEPS,
    OPEN_API_SCHEDULES,
    OPEN_API_STEPS,
    openApiAuthOf,
    storedOpenApiDraft,
} from "./openapi-wizard.shared"
import type { OpenApiDraft, OpenApiOp, OpenApiPullDef } from "./openapi-wizard.shared"
import { useOpenApiCommands } from "./useOpenApiCommands"
import { useOpenApiTest } from "./useOpenApiTest"

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
    const editing = Boolean(resumeId)
    const hydrated = useRef(false)

    const [index, setIndex] = useState(0)
    const [draft, setDraft] = useState<OpenApiDraft>(EMPTY_OPEN_API_DRAFT)
    const [connId, setConnId] = useState<string | null>(resumeId ?? null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const patch = (next: Partial<OpenApiDraft>) => setDraft((current) => ({ ...current, ...next }))

    // Opens a saved connection once: its config, then the fresh operations of its spec link when it has one.
    const saved = useQueryLoadOpenApiConnectionSwr(resumeId, {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        onSuccess: (connection) => {
            if (hydrated.current) return
            hydrated.current = true
            const { config, auth, draft: stored } = storedOpenApiDraft(connection)
            authForm.reset(auth)
            patch(stored)
            if (!config.specUrl) return
            void commands.loadSpec(config.specUrl, "").then((fresh) => {
                if (fresh.kind !== "ok") return
                const keep = new Set([...config.pulls.map((p) => p.opId), ...config.tools])
                patch({
                    ops: [
                        ...fresh.value.ops,
                        ...config.ops.filter((o) => keep.has(o.id) && !fresh.value.ops.some((f) => f.id === o.id)),
                    ],
                })
            })
        },
    })

    const steps = editing ? OPEN_API_EDIT_STEPS : OPEN_API_STEPS
    const step = steps[index] ?? "source"
    const sourceKey = `${draft.specUrl.trim()}|${draft.specText.length}`
    const authType = authForm.watch("authType")

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }

    const onPull = (op: OpenApiOp, pull: OpenApiPullDef | null) =>
        setDraft((current) => {
            const others = current.pulls.filter((p) => p.opId !== op.id)
            return { ...current, pulls: pull ? [...others, pull] : others }
        })

    const tester = useOpenApiTest({
        commands,
        authForm,
        connectionId: connId,
        ops: draft.ops,
        pulls: draft.pulls,
        onPull,
        onError: setError,
    })

    const loadSpec = () =>
        startTransition(async () => {
            setError(null)
            const answer = await commands.loadSpec(draft.specUrl, draft.specText)
            if (answer.kind !== "ok") return setError(answer.message)
            const spec = answer.value
            if (!authForm.getValues("baseUrl").trim())
                authForm.setValue("baseUrl", spec.baseUrl, { shouldValidate: true })
            if (authForm.getValues("authType") === "none" && !draft.hasSecret) {
                authForm.setValue("authType", spec.authType, { shouldValidate: true })
                authForm.setValue("authName", spec.authName, { shouldValidate: true })
            }
            const ids = new Set(spec.ops.map((o) => o.id))
            setDraft((current) => ({
                ...current,
                ops: spec.ops,
                loadedKey: sourceKey,
                name: !current.name.trim() && spec.title ? spec.title : current.name,
                pulls: current.pulls.filter((x) => ids.has(x.opId)),
                tools: current.tools.filter((id) => ids.has(id)),
            }))
            go(1)
        })

    const save = () =>
        startTransition(async () => {
            setError(null)
            const keep = new Set([...draft.pulls.map((p) => p.opId), ...draft.tools])
            const values = authForm.getValues()
            const answer = await commands.save({
                connectionId: connId,
                name: draft.name,
                auth: openApiAuthOf(values),
                syncEveryMinutes: OPEN_API_SCHEDULES.find((s) => s.id === draft.schedule)?.minutes ?? null,
                config: {
                    v: 1,
                    specUrl: draft.specUrl.trim(),
                    baseUrl: values.baseUrl.trim(),
                    authType: values.authType,
                    authName: values.authName.trim(),
                    ops: draft.ops.filter((o) => keep.has(o.id)),
                    pulls: draft.pulls,
                    tools: draft.tools,
                },
            })
            if (answer.kind !== "ok") return setError(answer.message)
            setConnId(answer.value)
            if (draft.pulls.length > 0) void startSync(answer.value)
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
        error: error ?? (saved.error instanceof Error ? saved.error.message : null),
        isPending,
        testing: tester.testing,
        authForm,
        authType,
        hasSecret: draft.hasSecret,
        source: {
            name: draft.name,
            specUrl: draft.specUrl,
            specText: draft.specText,
            ready: Boolean(draft.specUrl.trim() || draft.specText.trim()),
            unchanged: draft.loadedKey === sourceKey && draft.ops.length > 0,
        },
        ops: draft.ops,
        pulls: draft.pulls,
        tools: draft.tools,
        schedule: draft.schedule,
        agentIds,
        authReady: authForm.formState.isValid,
        test: tester.test,
        on: {
            go,
            setName: (name: string) => patch({ name }),
            setSpecUrl: (specUrl: string) => patch({ specUrl }),
            setSpecText: (specText: string) => patch({ specText }),
            loadSpec,
            onPull,
            setTools: (tools: ReadonlyArray<string>) => patch({ tools }),
            setSchedule: (schedule: string) => patch({ schedule }),
            setTestOpId: tester.setTestOpId,
            setTestQuery: tester.setTestQuery,
            runTest: tester.runTest,
            save,
            finish,
            setAgentIds,
            close: () => onClose(false),
        },
    }
}
