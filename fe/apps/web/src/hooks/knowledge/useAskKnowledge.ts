"use client"

import { useQueryAskKnowledgeSwr } from "@/hooks/swr"
import { toRetrievedPassage, type RetrievedPassage } from "@/modules/documents"
import type { AgentLens } from "@/modules/brain"

import { useState, useTransition } from "react"

/** Who the answer is for: customers see public passages only. */
export type AskAudience = "customer" | "internal"

/** What the "ask as an agent" panel gives its block. */
interface AskKnowledge {
    readonly question: string
    /** The agent the question is asked as: the one chosen, else the first installed one. */
    readonly agent: AgentLens | undefined
    /** The audience the question is asked for: an agent that only talks to customers is always asked for them. */
    readonly audience: AskAudience
    /** Whether the person may pick the audience: only an agent that talks to the team has two. */
    readonly canPickAudience: boolean
    /** Null until a question was asked. */
    readonly results: ReadonlyArray<RetrievedPassage> | null
    /** The server-localized message of why the last question failed. */
    readonly error: string | null
    readonly isPending: boolean
    readonly setQuestion: (value: string) => void
    readonly setAgent: (value: string | null) => void
    readonly setAudience: (value: string) => void
    readonly ask: () => void
}

/** The "ask as an agent" panel: asks the back end what an agent would retrieve, through that agent's own view. Reads only. */
export const useAskKnowledge = (agents: ReadonlyArray<AgentLens>): AskKnowledge => {
    const { trigger } = useQueryAskKnowledgeSwr()
    const [question, setQuestion] = useState("")
    const [chosen, setChosen] = useState<string | undefined>()
    const [picked, setPicked] = useState<AskAudience | undefined>()
    const [results, setResults] = useState<ReadonlyArray<RetrievedPassage> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const agent = agents.find((one) => one.id === chosen) ?? agents[0]
    const canPickAudience = agent?.audience === "internal"
    const audience: AskAudience = canPickAudience ? (picked ?? "internal") : "customer"
    const ask = () => {
        const text = question.trim().slice(0, 500)
        if (text === "" || agent === undefined) return
        const { module, installationId } = agent
        if (module === null) return
        setError(null)
        startTransition(async () => {
            try {
                const passages = await trigger({
                    question: text,
                    module,
                    audience,
                    ...(installationId === null ? {} : { installationId }),
                })
                setResults(passages.map(toRetrievedPassage))
            } catch (error_) {
                setResults(null)
                setError(error_ instanceof Error ? error_.message : null)
            }
        })
    }
    return {
        question,
        agent,
        audience,
        canPickAudience,
        results,
        error,
        isPending,
        setQuestion,
        setAgent: (value) => {
            setChosen(agents.find((one) => one.id === value)?.id ?? chosen)
            setPicked(undefined)
            setResults(null)
        },
        setAudience: (value) => setPicked(value === "internal" ? "internal" : "customer"),
        ask,
    }
}
