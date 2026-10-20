"use client"

import { useQueryLoadTelegramUserSetupSwr, useQueryTelegramUserReadySwr } from "@/hooks/swr"
import { BLANK_INITIAL, chatKindOf, sinceDaysOf } from "./telegram-user-wizard.shared"
import type { TelegramInitial } from "./telegram-user-wizard.shared"

/** Fresh reads on every open: a cached login stage must never be resumed. */
const FRESH = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false } as const

/** What the wizard knows before it can draw its first step. */
export interface TelegramBoot {
    /** Reading the server and the saved state; unconfigured: no Telegram app credentials; failed: the saved state could not be read. */
    readonly status: "loading" | "unconfigured" | "failed" | "ready"
    /** The failure message when `status` is failed. */
    readonly error: string | null
    /** Where the wizard starts. */
    readonly initial: TelegramInitial
}

/** Is the server set up for personal Telegram, and is this a resumed login or an edit? Answers once both reads are fresh. */
export const useTelegramUserBoot = (resumeId: string | undefined): TelegramBoot => {
    const ready = useQueryTelegramUserReadySwr(FRESH)
    const setup = useQueryLoadTelegramUserSetupSwr(resumeId, FRESH)
    if (ready.isLoading || ready.isValidating) return { status: "loading", error: null, initial: BLANK_INITIAL }
    if (!ready.data?.configured) {
        return { status: "unconfigured", error: null, initial: BLANK_INITIAL }
    }
    if (resumeId === undefined) return { status: "ready", error: null, initial: BLANK_INITIAL }
    if (setup.isLoading || setup.isValidating) return { status: "loading", error: null, initial: BLANK_INITIAL }
    const state = setup.data
    if (state === undefined) {
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
}
