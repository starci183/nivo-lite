"use client"

import { useQueryLoadTelegramUserSetupSwr, useQueryTelegramUserReadySwr } from "@/hooks/swr"
import type { SlotRead } from "@/hooks/slot"
import { BLANK_INITIAL, chatKindOf, sinceDaysOf } from "./telegram-user-wizard.shared"
import type { TelegramInitial } from "./telegram-user-wizard.shared"

/** Revalidates on open while settled cached content remains visible. */
const FRESH = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const

/** What the wizard knows before it can draw its first step. */
export interface TelegramBoot {
    readonly reads: ReadonlyArray<SlotRead<unknown>>
    readonly bootData: { readonly isConfigured: boolean } | undefined
    /** Reading the server and the saved state; unconfigured: no Telegram app credentials; failed: the saved state could not be read. */
    readonly status: "loading" | "unconfigured" | "failed" | "ready"
    /** The failure message when `status` is failed. */
    readonly error: string | null
    /** Where the wizard starts. */
    readonly initial: TelegramInitial
    /** Reads the server and the saved state again. */
    readonly retry: () => void
}

/** The domain answer of the two reads, without their public read and retry contracts. */
type BootAnswer = Pick<TelegramBoot, "status" | "error" | "initial">

/** Whether the server is configured and where a resumed login or edit starts; revalidation never blanks settled data. */
export const useTelegramUserBoot = (resumeId: string | undefined): TelegramBoot => {
    const ready = useQueryTelegramUserReadySwr(FRESH)
    const setup = useQueryLoadTelegramUserSetupSwr(resumeId, FRESH)
    const reads: ReadonlyArray<SlotRead<unknown>> = resumeId === undefined ? [ready] : [ready, setup]
    const retry = () => {
        void ready.mutate()
        if (resumeId !== undefined) void setup.mutate()
    }
    const answer = ((): BootAnswer => {
        if (ready.data === undefined) {
            if (ready.isLoading) return { status: "loading", error: null, initial: BLANK_INITIAL }
            const message = ready.error instanceof Error ? ready.error.message : null
            return { status: "failed", error: message, initial: BLANK_INITIAL }
        }
        if (!ready.data.configured) return { status: "unconfigured", error: null, initial: BLANK_INITIAL }
        if (resumeId === undefined) return { status: "ready", error: null, initial: BLANK_INITIAL }
        const state = setup.data
        if (state === undefined) {
            if (setup.isLoading) return { status: "loading", error: null, initial: BLANK_INITIAL }
            const message = setup.error instanceof Error ? setup.error.message : null
            return { status: "failed", error: message, initial: BLANK_INITIAL }
        }
        const done = state.stage === "ready"
        return {
            status: "ready",
            error: null,
            initial: {
                name: state.name,
                consent: state.consent,
                everyMinutes: state.everyMinutes ?? null,
                picked: (state.config?.chats ?? []).map((chat) => ({
                    id: chat.id,
                    title: chat.title,
                    kind: chatKindOf(chat.kind),
                })),
                sinceDays: sinceDaysOf(state.config?.sinceDays ?? 7),
                stage: state.stage === "password" ? "password" : "code",
                index: done ? 2 : 1,
                editing: done,
            },
        }
    })()
    return {
        ...answer,
        reads,
        bootData: ready.data === undefined ? undefined : { isConfigured: ready.data.configured },
        retry,
    }
}
