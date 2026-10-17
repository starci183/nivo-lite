"use client"

import { OPEN_API_EDIT_STEPS, OPEN_API_STEPS, openApiAuthTypeOf } from "./openapi-wizard.shared"
import type { OpenApiStep, OpenApiAuthField } from "./openapi-wizard.shared"
import { useOpenApiWizardCommands } from "./useOpenApiWizardCommands"
import { useConnectionsRefresh, useSetConnectionAgents, useSyncNow } from "@/hooks/connections"
import { useOpenApiAuthForm } from "@/hooks/rhf"
import type { OpenApiAuthValues } from "@/hooks/rhf"
import { useState } from "react"
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

    const steps = editing ? OPEN_API_EDIT_STEPS : OPEN_API_STEPS
    const step = steps[index] ?? "source"
    const loadError = useOpenApiResume({
        resumeId,
        authForm,
        restoreSource: source.restore,
        setOps: source.setOps,
        restorePicks: picks.restore,
    })

    const authInput = () => openApiAuthInputOf(authForm.getValues())
    const test = useOpenApiTest({
        ops: source.ops,
        pulls: picks.pulls,
        commands,
        connectionId: connId,
        target: () => ({ baseUrl: authForm.getValues("baseUrl"), auth: authInput() }),
        onPull: picks.onPull,
        fail: setError,
    })

    const { loadSpec, save, go, finish, isPending } = useOpenApiWizardCommands(
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
    )

    return viewOf(
        index,
        steps,
        step,
        editing,
        error,
        loadError,
        isPending,
        authForm.watch(),
        authForm,
        source,
        picks,
        test,
        agentIds,
        go,
        loadSpec,
        save,
        finish,
        setAgentIds,
        onClose,
    )
}

const viewOf = (
    index: number,
    steps: readonly OpenApiStep[],
    step: OpenApiStep,
    editing: boolean,
    error: string | null,
    loadError: ReturnType<typeof useOpenApiResume>,
    isPending: boolean,
    auth: OpenApiAuthValues,
    authForm: ReturnType<typeof useOpenApiAuthForm>,
    source: ReturnType<typeof useOpenApiSource>,
    picks: ReturnType<typeof useOpenApiPicks>,
    test: ReturnType<typeof useOpenApiTest>,
    agentIds: readonly string[],
    go: (to: number) => void,
    loadSpec: () => void,
    save: () => void,
    finish: () => void,
    setAgentIds: import("react").Dispatch<import("react").SetStateAction<ReadonlyArray<string>>>,
    onClose: (changed: boolean) => void,
) => {
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

/** The authentication values sent in an OpenAPI target. */
const openApiAuthInputOf = (values: OpenApiAuthValues) => ({
    type: values.authType,
    name: values.authName,
    value: values.authValue,
    user: values.authUser,
    password: values.authPassword,
})
