"use client"

import { useQueryAskKnowledgeSwr } from "@/hooks/swr"
import { AGENT_MODULES, toRetrievedPassage, type AgentModule, type RetrievedPassage } from "@/modules/documents"

import { useState, useTransition } from "react"

/** Who the answer is for: customers see public passages only. */
export type AskAudience = "customer" | "internal"

/** What the "try a question" panel gives its block. */
interface AskKnowledge {
    readonly question: string
    readonly module: AgentModule | undefined
    readonly audience: AskAudience
    /** Null until a question was asked. */
    readonly results: ReadonlyArray<RetrievedPassage> | null
    /** The server-localized message of why the last question failed. */
    readonly error: string | null
    readonly isPending: boolean
    readonly setQuestion: (value: string) => void
    readonly setModule: (value: string | null) => void
    readonly setAudience: (value: string) => void
    readonly ask: () => void
}

/** The "try a question" panel: asks the back end what an agent would retrieve, as a customer or as the business. */
export const useAskKnowledge = (initialModule: AgentModule | undefined): AskKnowledge => {
    const { trigger } = useQueryAskKnowledgeSwr()
    const [question, setQuestion] = useState("")
    const [chosen, setChosen] = useState<AgentModule | undefined>()
    const module = chosen ?? initialModule
    const [audience, setAudience] = useState<AskAudience>("customer")
    const [results, setResults] = useState<ReadonlyArray<RetrievedPassage> | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const ask = () => {
        const text = question.trim().slice(0, 500)
        if (text === "" || module === undefined) return
        setError(null)
        startTransition(async () => {
            try {
                const passages = await trigger({ question: text, module, audience })
                setResults(passages.map(toRetrievedPassage))
            } catch (error_) {
                setResults(null)
                setError(error_ instanceof Error ? error_.message : null)
            }
        })
    }
    return {
        question,
        module,
        audience,
        results,
        error,
        isPending,
        setQuestion,
        setModule: (value) => {
            setChosen(AGENT_MODULES.find((key) => key === value) ?? module)
        },
        setAudience: (value) => setAudience(value === "internal" ? "internal" : "customer"),
        ask,
    }
}
