"use client"

import { OPEN_API_EDIT_STEPS, OPEN_API_STEPS } from "./openapi-wizard.shared"
import { openApiAuthInputOf, viewOf } from "./useOpenApiWizardView"
import { useOpenApiWizardCommands } from "./useOpenApiWizardCommands"
import { useOpenApiAuthForm } from "@/hooks/rhf"
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

type UseOpenApiWizardResult = ReturnType<typeof viewOf>

/** The state machine of the OpenAPI wizard: spec, auth, pulled endpoints, agent tools, schedule, test, agents. */
export const useOpenApiWizard = ({ resumeId, onClose }: OpenApiWizardInput): UseOpenApiWizardResult => {
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
