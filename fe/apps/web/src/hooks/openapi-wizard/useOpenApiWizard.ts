"use client"

import {
    OPEN_API_EDIT_STEPS,
    OPEN_API_STEPS,
    openApiAuthTypeOf,
    type OpenApiStep,
    type OpenApiAuthField,
} from "./openapi-wizard.shared"

import { useOpenApiWizardCommands } from "./useOpenApiWizardCommands"
import { useOpenApiAuthForm, type OpenApiAuthValues } from "@/hooks/rhf"
import type { SlotRead } from "@/hooks/slot"

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
    const {
        error: loadError,
        reads,
        retry: retryReads,
    } = useOpenApiResume({
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

    const { loadSpec, save, go, finish, isPending } = useOpenApiWizardCommands({
        setError,
        commands,
        source,
        authForm,
        picks,
        connId,
        authInput,
        setConnId,
        editing,
        onClose,
        index,
        setIndex,
        agentIds,
    })

    return viewOf({
        index,
        steps,
        step,
        editing,
        error,
        loadError,
        reads,
        retryReads,
        isPending,
        auth: authForm.watch(),
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
    })
}

/** What the view of the OpenAPI wizard is made of: its state, its reads and its commands. */
type OpenApiWizardViewInput = {
    readonly index: number
    readonly steps: readonly OpenApiStep[]
    readonly step: OpenApiStep
    readonly editing: boolean
    readonly error: string | null
    readonly loadError: string | null
    readonly reads: ReadonlyArray<SlotRead<unknown>>
    readonly retryReads: () => void
    readonly isPending: boolean
    readonly auth: OpenApiAuthValues
    readonly authForm: ReturnType<typeof useOpenApiAuthForm>
    readonly source: ReturnType<typeof useOpenApiSource>
    readonly picks: ReturnType<typeof useOpenApiPicks>
    readonly test: ReturnType<typeof useOpenApiTest>
    readonly agentIds: readonly string[]
    readonly go: (to: number) => void
    readonly loadSpec: () => void
    readonly save: () => void
    readonly finish: () => void
    readonly setAgentIds: import("react").Dispatch<import("react").SetStateAction<ReadonlyArray<string>>>
    readonly onClose: (changed: boolean) => void
}

/** The view the OpenAPI wizard hands its drawer: the step it stands on, the reads, the forms and every command. */
const viewOf = (input: OpenApiWizardViewInput) => {
    const { authForm, source } = input
    return {
        reads: input.reads,
        retryReads: input.retryReads,
        index: input.index,
        steps: input.steps,
        step: input.step,
        editing: input.editing,
        error: input.error ?? input.loadError,
        isPending: input.isPending,
        auth: {
            values: input.auth,
            errors: {
                baseUrl: authForm.formState.errors.baseUrl?.message,
                authName: authForm.formState.errors.authName?.message,
            },
            hasSecret: source.hasSecret,
            ready: authForm.formState.isValid,
        },
        source,
        picks: input.picks,
        test: input.test,
        agentIds: input.agentIds,
        on: {
            go: input.go,
            loadSpec: input.loadSpec,
            save: input.save,
            finish: input.finish,
            setAgentIds: input.setAgentIds,
            close: () => input.onClose(false),
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
