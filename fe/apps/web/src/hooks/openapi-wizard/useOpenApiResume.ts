"use client"

import { useEffect, useMemo, useRef } from "react"
import type { useOpenApiAuthForm } from "@/hooks/rhf"
import { useQueryLoadOpenApiConnectionSwr, useQueryLoadOpenApiSpecSwr } from "@/hooks/swr"
import { mergeOpenApiOps, openApiScheduleIdOf, parseOpenApiConfig, parseOpenApiOps } from "./openapi-wizard.shared"
import type { useOpenApiPicks } from "./useOpenApiPicks"
import type { useOpenApiSource } from "./useOpenApiSource"

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

/**
 * Opens a saved connection once: its config seeds the steps, then the fresh operations of its spec link (when it has one) replace the
 * stored ones, keeping the stored operations that are pulled or offered as tools. Answers the load failure, if any.
 */
export const useOpenApiResume = (input: OpenApiResumeInput): string | null => {
    const { authForm, restoreSource, setOps, restorePicks } = input
    const saved = useQueryLoadOpenApiConnectionSwr(input.resumeId, ONCE)
    const config = useMemo(
        () => (saved.data === undefined ? null : parseOpenApiConfig(saved.data.config)),
        [saved.data],
    )
    const fresh = useQueryLoadOpenApiSpecSwr(
        config === null || config.specUrl === "" ? undefined : config.specUrl,
        ONCE,
    )
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

    return saved.error instanceof Error ? saved.error.message : null
}
