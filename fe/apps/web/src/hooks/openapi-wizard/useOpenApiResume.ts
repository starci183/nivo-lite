"use client"

import { useEffect, useMemo, useRef } from "react"
import type { useOpenApiAuthForm } from "@/hooks/rhf"
import { useQueryLoadOpenApiConnectionSwr, useQueryLoadOpenApiSpecSwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import { readError } from "@/hooks/workspaceread"
import { mergeOpenApiOps, openApiScheduleIdOf } from "./openapi-wizard.ops"
import { parseOpenApiConfig, parseOpenApiOps } from "./openapi-wizard.shared"
import type { useOpenApiPicks } from "./useOpenApiPicks"
import type { useOpenApiSource } from "./useOpenApiSource"
import type { OpenApiConfigView } from "./openapi-wizard.shared"

/** Reads once: an edited connection must not be overwritten by a revalidation while the owner types. */
const ONCE = { revalidateOnFocus: false, revalidateIfStale: false } as const

/** Where a reopened connection is poured. */
interface OpenApiResumeInput {
    readonly resumeId: string | undefined
    readonly authForm: ReturnType<typeof useOpenApiAuthForm>
    readonly restoreSource: ReturnType<typeof useOpenApiSource>["restore"]
    readonly setOps: ReturnType<typeof useOpenApiSource>["setOps"]
    readonly restorePicks: ReturnType<typeof useOpenApiPicks>["restore"]
}

type UseOpenApiResumeResult = {
    reads: readonly SlotRead<unknown>[]
    error: string | null
    retry: () => void
}

/**
 * Opens a saved connection once: its config seeds the steps, then the fresh operations of its spec link (when it has one) replace the
 * stored ones, keeping the stored operations that are pulled or offered as tools. Answers the load failure, if any.
 */
export const useOpenApiResume = (input: OpenApiResumeInput): UseOpenApiResumeResult => {
    const { authForm, restoreSource, setOps, restorePicks } = input
    const saved = useQueryLoadOpenApiConnectionSwr(input.resumeId, ONCE)
    const parsed = useMemo(
        () => (saved.data === undefined ? { config: null, error: undefined } : configOf(saved.data.config)),
        [saved.data],
    )
    const config = parsed.config
    const specUrl = config === null || config.specUrl === "" ? undefined : config.specUrl
    const fresh = useQueryLoadOpenApiSpecSwr(specUrl, ONCE)
    const savedRead = {
        data: config === null ? undefined : saved.data,
        isLoading: saved.isLoading,
        isValidating: saved.isValidating,
        error: parsed.error ?? readError(saved),
    }
    const reads: ReadonlyArray<SlotRead<unknown>> = [
        ...(input.resumeId === undefined ? [] : [savedRead]),
        ...(specUrl === undefined ? [] : [fresh]),
    ]
    const seeded = useRef(false)
    const merged = useRef(false)

    useEffect(() => {
        const data = saved.data
        if (seeded.current || data === undefined || config === null) return
        seeded.current = true
        restoreSource({ name: data.name, specUrl: config.specUrl, ops: config.ops, hasSecret: data.hasSecret })
        authForm.reset({
            baseUrl: config.baseUrl,
            authType: config.authType,
            authName: config.authName,
            authValue: "",
            authUser: data.authUser,
            authPassword: "",
        })
        restorePicks({
            pulls: config.pulls,
            tools: config.tools,
            schedule: openApiScheduleIdOf(data.syncEveryMinutes ?? null),
        })
    }, [saved.data, config, authForm, restoreSource, restorePicks])

    useEffect(() => {
        if (merged.current || config === null || fresh.data === undefined) return
        merged.current = true
        setOps(mergeOpenApiOps(parseOpenApiOps(fresh.data.ops), config))
    }, [fresh.data, config, setOps])

    const error = reads.find((read) => read.error !== undefined)?.error
    return {
        reads,
        error: error instanceof Error ? error.message : null,
        retry: (): void => {
            if (input.resumeId !== undefined) void saved.mutate()
            if (specUrl !== undefined) void fresh.mutate()
        },
    }
}

/** Keeps a stored configuration failure in the read that owns it instead of crashing the wizard. */
const configOf = (raw: unknown): { readonly config: OpenApiConfigView | null; readonly error: unknown } => {
    try {
        return { config: parseOpenApiConfig(raw), error: undefined }
    } catch (error: unknown) {
        return { config: null, error }
    }
}
