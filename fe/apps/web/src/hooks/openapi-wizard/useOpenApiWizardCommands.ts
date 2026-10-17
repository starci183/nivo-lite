"use client"

import { useTransition } from "react"
import type { useConnectionsRefresh, useSetConnectionAgents } from "@/hooks/connections"
import type { useOpenApiAuthForm } from "@/hooks/rhf"
import { openApiScheduleMinutesOf } from "./openapi-wizard.shared"
import type { OpenApiCommands } from "./useOpenApiCommands"
import type { useOpenApiPicks } from "./useOpenApiPicks"
import type { useOpenApiSource } from "./useOpenApiSource"

const createOpenApiWizardActions = (
    startTransition: import("react").TransitionStartFunction,
    setError: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    commands: OpenApiCommands,
    source: ReturnType<typeof useOpenApiSource>,
    authForm: ReturnType<typeof useOpenApiAuthForm>,
    picks: ReturnType<typeof useOpenApiPicks>,
    connId: string | null,
    authInput: () => {
        type: "query" | "header" | "none" | "bearer" | "basic"
        name: string
        value: string
        user: string
        password: string
    },
    setConnId: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    startSync: (connectionId: string) => Promise<void>,
    editing: boolean,
    onClose: (changed: boolean) => void,
    index: number,
    setIndex: import("react").Dispatch<import("react").SetStateAction<number>>,
    setConnectionAgents: ReturnType<typeof useSetConnectionAgents>,
    agentIds: ReadonlyArray<string>,
    refresh: ReturnType<typeof useConnectionsRefresh>,
) => {
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
    const go = (to: number) => {
        setError(null)
        setIndex(to)
    }
    const finish = () =>
        startTransition(async () => {
            if (!connId) return onClose(false)
            const answer = await setConnectionAgents(connId, agentIds)
            if (answer.kind !== "ok") return setError(answer.message)
            await refresh()
            onClose(true)
        })
    return { loadSpec, save, go, finish }
}

/** Owns the OpenAPI command transition and its actions. */
export const useOpenApiWizardCommands = (
    setError: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    commands: OpenApiCommands,
    source: ReturnType<typeof useOpenApiSource>,
    authForm: ReturnType<typeof useOpenApiAuthForm>,
    picks: ReturnType<typeof useOpenApiPicks>,
    connId: string | null,
    authInput: () => {
        type: "query" | "header" | "none" | "bearer" | "basic"
        name: string
        value: string
        user: string
        password: string
    },
    setConnId: import("react").Dispatch<import("react").SetStateAction<string | null>>,
    startSync: (connectionId: string) => Promise<void>,
    editing: boolean,
    onClose: (changed: boolean) => void,
    index: number,
    setIndex: import("react").Dispatch<import("react").SetStateAction<number>>,
    setConnectionAgents: ReturnType<typeof useSetConnectionAgents>,
    agentIds: ReadonlyArray<string>,
    refresh: ReturnType<typeof useConnectionsRefresh>,
) => {
    const [isPending, startTransition] = useTransition()
    return {
        ...createOpenApiWizardActions(
            startTransition,
            setError,
            commands,
            source,
            authForm,
            picks,
            connId,
            authInput,
            setConnId,
            startSync,
            editing,
            onClose,
            index,
            setIndex,
            setConnectionAgents,
            agentIds,
            refresh,
        ),
        isPending,
    }
}
