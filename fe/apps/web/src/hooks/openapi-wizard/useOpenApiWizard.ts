"use client"

import { useState, useTransition } from "react"
import { useConnectionsRefresh, useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useOpenApiAuthForm } from "@/hooks/rhf"
import {
    OPEN_API_EDIT_STEPS,
    OPEN_API_STEPS,
    openApiAuthTypeOf,
    openApiScheduleMinutesOf,
} from "./openapi-wizard.shared"
import type { OpenApiAuthField } from "./openapi-wizard.shared"
import { useOpenApiCommands } from "./useOpenApiCommands"
import { useOpenApiPicks } from "./useOpenApiPicks"
import { useOpenApiResume } from "./useOpenApiResume"
import { useOpenApiSource } from "./useOpenApiSource"
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
    const source = useOpenApiSource()
    const picks = useOpenApiPicks(source.ops)

    const [index, setIndex] = useState(0)
    const [connId, setConnId] = useState<string | null>(resumeId ?? null)
    const [agentIds, setAgentIds] = useState<ReadonlyArray<string>>([])
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()

    const steps = editing ? OPEN_API_EDIT_STEPS : OPEN_API_STEPS
    const step = steps[index] ?? "source"
    const auth = authForm.watch()
    const loadError = useOpenApiResume({
        resumeId,
        authForm,
        restoreSource: source.restore,
        setOps: source.setOps,
        restorePicks: picks.restore,
    })

    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }
    const authInput = () => {
        const values = authForm.getValues()
        return {
            type: values.authType,
            name: values.authName,
            value: values.authValue,
            user: values.authUser,
            password: values.authPassword,
        }
    }
    const test = useOpenApiTest({
        ops: source.ops,
        pulls: picks.pulls,
        commands,
        connectionId: connId,
        target: () => ({ baseUrl: authForm.getValues("baseUrl"), auth: authInput() }),
        onPull: picks.onPull,
        fail: setError,
    })

    const loadSpec = () =>
        startTransition(async () => {
            setError(null)
            const answer = await commands.loadSpec(source.specUrl, source.specText)
            if (answer.kind !== "ok") return setError(answer.message)
            const spec = answer.value
            source.loaded(spec.ops)
            if (!authForm.getValues("baseUrl").trim())
                authForm.setValue("baseUrl", spec.baseUrl, { shouldValidate: true })
            if (authForm.getValues("authType") === "none" && !source.hasSecret) {
                authForm.setValue("authType", spec.authType, { shouldValidate: true })
                authForm.setValue("authName", spec.authName, { shouldValidate: true })
            }
            if (!source.name.trim() && spec.title) source.setName(spec.title)
            picks.keepOnly(new Set(spec.ops.map((op) => op.id)))
            go(1)
        })

    const save = () =>
        startTransition(async () => {
            setError(null)
            const keep = new Set([...picks.pulls.map((pull) => pull.opId), ...picks.tools])
            const values = authForm.getValues()
            const answer = await commands.save({
                connectionId: connId,
                name: source.name,
                auth: authInput(),
                syncEveryMinutes: openApiScheduleMinutesOf(picks.schedule),
                config: {
                    v: 1,
                    specUrl: source.specUrl.trim(),
                    baseUrl: values.baseUrl.trim(),
                    authType: values.authType,
                    authName: values.authName.trim(),
                    ops: source.ops.filter((op) => keep.has(op.id)),
                    pulls: picks.pulls,
                    tools: picks.tools,
                },
            })
            if (answer.kind !== "ok") return setError(answer.message)
            setConnId(answer.value)
            if (picks.pulls.length > 0) void startSync(answer.value)
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
        error: error ?? loadError,
        isPending,
        auth: {
            values: auth,
            errors: {
                baseUrl: authForm.formState.errors.baseUrl?.message,
                authName: authForm.formState.errors.authName?.message,
            },
            hasSecret: source.hasSecret,
            ready: authForm.formState.isValid,
        },
        source,
        picks,
        test,
        agentIds,
        on: {
            go,
            loadSpec,
            save,
            finish,
            setAgentIds,
            close: () => onClose(false),
            authField: (field: OpenApiAuthField, value: string) =>
                authForm.setValue(field, value, { shouldValidate: true }),
            authType: (value: string | null) => {
                const next = openApiAuthTypeOf(value)
                if (next !== undefined) authForm.setValue("authType", next, { shouldValidate: true })
            },
        },
    }
}
