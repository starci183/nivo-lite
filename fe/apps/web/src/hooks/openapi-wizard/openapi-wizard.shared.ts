import type { Dispatch, SetStateAction } from "react"
import type { useOpenApiAuthForm, OpenApiAuthValues } from "@/hooks/rhf"
import type { SlotRead } from "@/hooks/slot"
import { openApiAuthTypeOf } from "@/modules/openapi-spec"
import type { OpenApiAuthField, OpenApiStep } from "@/modules/openapi-spec"
import type { useOpenApiPicks } from "./useOpenApiPicks"
import type { useOpenApiSource } from "./useOpenApiSource"
import type { useOpenApiTest } from "./useOpenApiTest"

/** What the view of the OpenAPI wizard is made of: its state, its reads and its commands. */
export type OpenApiWizardViewInput = {
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
    readonly setAgentIds: Dispatch<SetStateAction<ReadonlyArray<string>>>
    readonly onClose: (changed: boolean) => void
}

/** The authentication values sent in an OpenAPI target. */
export interface OpenApiAuthInput {
    readonly type: OpenApiAuthValues["authType"]
    readonly name: string
    readonly value: string
    readonly user: string
    readonly password: string
}

/** What the OpenAPI wizard hands its drawer: the step, the reads, the forms and every command. */
export interface OpenApiWizardView {
    readonly reads: OpenApiWizardViewInput["reads"]
    readonly retryReads: () => void
    readonly index: number
    readonly steps: readonly OpenApiStep[]
    readonly step: OpenApiStep
    readonly editing: boolean
    readonly error: string | null
    readonly isPending: boolean
    readonly auth: {
        readonly values: OpenApiAuthValues
        readonly errors: { readonly baseUrl: string | undefined; readonly authName: string | undefined }
        readonly hasSecret: OpenApiWizardViewInput["source"]["hasSecret"]
        readonly ready: boolean
    }
    readonly source: OpenApiWizardViewInput["source"]
    readonly picks: OpenApiWizardViewInput["picks"]
    readonly test: OpenApiWizardViewInput["test"]
    readonly agentIds: readonly string[]
    readonly on: {
        readonly go: (to: number) => void
        readonly loadSpec: () => void
        readonly save: () => void
        readonly finish: () => void
        readonly setAgentIds: Dispatch<SetStateAction<ReadonlyArray<string>>>
        readonly close: () => void
        readonly authField: (field: OpenApiAuthField, value: string) => void
        readonly authType: (value: string | null) => void
    }
}

/** The view the OpenAPI wizard hands its drawer: the step it stands on, the reads, the forms and every command. */
export const viewOf = (input: OpenApiWizardViewInput): OpenApiWizardView => {
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
            close: (): void => input.onClose(false),
            authField: (field: OpenApiAuthField, value: string): void =>
                authForm.setValue(field, value, { shouldValidate: true }),
            authType: (value: string | null): void => {
                const next = openApiAuthTypeOf(value)
                if (next !== undefined) authForm.setValue("authType", next, { shouldValidate: true })
            },
        },
    }
}

/** Reads the authentication values of the form into the shape sent in an OpenAPI target. */
export const openApiAuthInputOf = (values: OpenApiAuthValues): OpenApiAuthInput => ({
    type: values.authType,
    name: values.authName,
    value: values.authValue,
    user: values.authUser,
    password: values.authPassword,
})
