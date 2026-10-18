"use client"

import { create } from "zustand"

/** A workbench action that holds the workspace's delivery lock. */
export type ChatbotAction = "reply" | "answer" | "handling"

/** Feedback shown beside the conversation that produced it. */
export interface ChatbotFeedback {
    readonly conversationId: string
    readonly kind: ChatbotAction
    readonly message: string
}

/** A durable queued delivery followed across workbench remounts. */
export interface ChatbotJob {
    readonly kind: "reply" | "answer"
    readonly conversationId: string
    readonly id: string
    readonly declined: boolean
    readonly attempt: number
}

/** Browser-lifetime state for one workspace and signed-in user. */
export interface ChatbotActionState {
    readonly job: ChatbotJob | undefined
    readonly requesting: ChatbotAction | null
    readonly feedback: ChatbotFeedback | null
    readonly sequence: number
    readonly reportedReadErrors: ReadonlyArray<string>
}

const NO_READ_ERRORS: ReadonlyArray<string> = Object.freeze([])

/** Stable selector fallback before an identity has started an action. */
export const CHATBOT_IDLE: ChatbotActionState = Object.freeze({
    job: undefined,
    requesting: null,
    feedback: null,
    sequence: 0,
    reportedReadErrors: NO_READ_ERRORS,
})

interface ChatbotStore {
    readonly actions: Readonly<Record<string, ChatbotActionState>>
    readonly start: (identity: string, kind: ChatbotAction) => boolean
    readonly queued: (identity: string, job: Omit<ChatbotJob, "attempt">) => void
    readonly release: (identity: string) => void
    readonly finish: (identity: string, job: ChatbotJob, feedback: ChatbotFeedback | null) => boolean
    readonly reportReadError: (identity: string, job: ChatbotJob, key: string) => boolean
}

const matchesJob = (current: ChatbotJob | undefined, job: ChatbotJob): boolean =>
    current?.id === job.id && current.kind === job.kind && current.attempt === job.attempt

/** Keeps action locks and status-toast deduplication across workbench remounts. */
export const useChatbotStore = create<ChatbotStore>((set) => ({
    actions: {},
    start: (identity, kind) => {
        let accepted = false
        set((state) => {
            const current = state.actions[identity] ?? CHATBOT_IDLE
            if (current.requesting !== null || current.job !== undefined) return state
            accepted = true
            return {
                actions: {
                    ...state.actions,
                    [identity]: {
                        ...current,
                        requesting: kind,
                        feedback: null,
                        sequence: current.sequence + 1,
                        reportedReadErrors: NO_READ_ERRORS,
                    },
                },
            }
        })
        return accepted
    },
    queued: (identity, job) => {
        set((state) => {
            const current = state.actions[identity] ?? CHATBOT_IDLE
            return {
                actions: {
                    ...state.actions,
                    [identity]: {
                        ...current,
                        requesting: null,
                        job: { ...job, attempt: current.sequence },
                    },
                },
            }
        })
    },
    release: (identity) => {
        set((state) => {
            const current = state.actions[identity]
            if (current?.requesting == null) return state
            return {
                actions: { ...state.actions, [identity]: { ...current, requesting: null } },
            }
        })
    },
    finish: (identity, job, feedback) => {
        let accepted = false
        set((state) => {
            const current = state.actions[identity]
            if (current === undefined || !matchesJob(current.job, job)) return state
            accepted = true
            return {
                actions: {
                    ...state.actions,
                    [identity]: { ...current, job: undefined, requesting: null, feedback },
                },
            }
        })
        return accepted
    },
    reportReadError: (identity, job, key) => {
        let accepted = false
        set((state) => {
            const current = state.actions[identity]
            if (current === undefined || !matchesJob(current.job, job) || current.reportedReadErrors.includes(key))
                return state
            accepted = true
            return {
                actions: {
                    ...state.actions,
                    [identity]: { ...current, reportedReadErrors: [...current.reportedReadErrors, key] },
                },
            }
        })
        return accepted
    },
}))
