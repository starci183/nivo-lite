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
import type { OpenApiPullField, OpenApiPullDef, OpenApiOp } from "./openapi-wizard.shared"
import type { SetStateAction, Dispatch } from "react"
import type { OpenApiSourceRestore } from "./useOpenApiSource"
import type { OpenApiPicksRestore } from "./useOpenApiPicks"

/** What the OpenAPI wizard needs from its drawer. */
interface OpenApiWizardInput {
    /** Continue or edit this existing connection instead of creating a new one. */
    readonly resumeId: string | undefined
    /** `changed` is true when something was saved, so the list refreshes. */
    readonly onClose: (changed: boolean) => void
}

type UseOpenApiWizardResult = {
    reads: readonly SlotRead<unknown>[]
    retryReads: () => void
    index: number
    steps: readonly OpenApiStep[]
    step: OpenApiStep
    editing: boolean
    error: string | null
    isPending: boolean
    auth: {
        values: OpenApiAuthValues
        errors: {
            baseUrl: string | undefined
            authName: string | undefined
        }
        hasSecret: boolean
        ready: boolean
    }
    source: {
        name: string
        specUrl: string
        specText: string
        ops: readonly {
            id: string
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
            path: string
            summary: string
            params: {
                name: string
                in: "header" | "query" | "path"
                required: boolean
            }[]
            hasBody: boolean
            suggest?:
                | {
                      itemsPath: string
                      idField: string
                      titleField: string
                  }
                | undefined
        }[]
        hasSecret: boolean
        ready: boolean
        unchanged: boolean
        setName: Dispatch<SetStateAction<string>>
        setSpecUrl: Dispatch<SetStateAction<string>>
        setSpecText: Dispatch<SetStateAction<string>>
        setOps: Dispatch<
            SetStateAction<
                readonly {
                    id: string
                    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
                    path: string
                    summary: string
                    params: {
                        name: string
                        in: "header" | "query" | "path"
                        required: boolean
                    }[]
                    hasBody: boolean
                    suggest?:
                        | {
                              itemsPath: string
                              idField: string
                              titleField: string
                          }
                        | undefined
                }[]
            >
        >
        restore: (saved: OpenApiSourceRestore) => void
        loaded: (next: ReadonlyArray<OpenApiOp>) => void
    }
    picks: {
        pulls: readonly {
            opId: string
            entity: "customer" | "order" | "product" | "transaction" | "other"
            itemsPath: string
            idField: string
            titleField: string
            fixedQuery: string
        }[]
        tools: readonly string[]
        schedule: string
        pullQuery: string
        toolQuery: string
        gets: {
            id: string
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
            path: string
            summary: string
            params: {
                name: string
                in: "header" | "query" | "path"
                required: boolean
            }[]
            hasBody: boolean
            suggest?:
                | {
                      itemsPath: string
                      idField: string
                      titleField: string
                  }
                | undefined
        }[]
        noGets: boolean
        tooMany: boolean
        visibleTools: {
            id: string
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
            path: string
            summary: string
            params: {
                name: string
                in: "header" | "query" | "path"
                required: boolean
            }[]
            hasBody: boolean
            suggest?:
                | {
                      itemsPath: string
                      idField: string
                      titleField: string
                  }
                | undefined
        }[]
        toolValue: string[]
        onPull: (op: OpenApiOp, pull: OpenApiPullDef | null) => void
        togglePull: (opId: string, on: boolean) => void
        patchPull: (opId: string, field: OpenApiPullField, value: string | null) => void
        keepOnly: (ids: ReadonlySet<string>) => void
        restore: (saved: OpenApiPicksRestore) => void
        setSchedule: (id: string | null) => void
        setPullQuery: Dispatch<SetStateAction<string>>
        setToolQuery: Dispatch<SetStateAction<string>>
        pickTools: (ids: ReadonlyArray<string>) => void
    }
    test: {
        testable: {
            id: string
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
            path: string
            summary: string
            params: {
                name: string
                in: "path" | "query" | "header"
                required: boolean
            }[]
            hasBody: boolean
            suggest?:
                | {
                      itemsPath: string
                      idField: string
                      titleField: string
                  }
                | undefined
        }[]
        activeTestId: string | null
        testOp: {
            id: string
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
            path: string
            summary: string
            params: {
                name: string
                in: "path" | "query" | "header"
                required: boolean
            }[]
            hasBody: boolean
            suggest?:
                | {
                      itemsPath: string
                      idField: string
                      titleField: string
                  }
                | undefined
        } | null
        testPull:
            | {
                  opId: string
                  entity: "customer" | "order" | "product" | "transaction" | "other"
                  itemsPath: string
                  idField: string
                  titleField: string
                  fixedQuery: string
              }
            | undefined
        testQuery: string
        testing: boolean
        result: {
            status: number
            itemCount: number
            itemsPath: string
            idField: string
            titleField: string
            sampleKeys: Array<string>
            error: string | null
        } | null
        setTestQuery: Dispatch<SetStateAction<string>>
        pickOp: (id: string | null) => void
        runTest: () => undefined
    }
    agentIds: readonly string[]
    on: {
        go: (to: number) => void
        loadSpec: () => void
        save: () => void
        finish: () => void
        setAgentIds: Dispatch<SetStateAction<readonly string[]>>
        close: () => void
        authField: (field: OpenApiAuthField, value: string) => void
        authType: (value: string | null) => void
    }
}

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
