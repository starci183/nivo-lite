import { useState, useTransition } from "react"
import { AGENT_MODULES, commandErrorKey, passagesOf, runCommand } from "@/modules/documents"
import type { AgentModule, CommandActions, RetrievedPassage } from "@/modules/documents"

/** Who the answer is for: customers see public passages only. */
export type AskAudience = "customer" | "internal"

/** What the "try a question" panel gives its block. */
interface AskKnowledge {
    readonly question: string
    readonly module: AgentModule
    readonly audience: AskAudience
    /** Null until a question was asked. */
    readonly results: ReadonlyArray<RetrievedPassage> | null
    /** The catalog key of why the last question failed. */
    readonly errorKey: string | null
    readonly isPending: boolean
    readonly setQuestion: (value: string) => void
    readonly setModule: (value: string | null) => void
    readonly setAudience: (value: string) => void
    readonly ask: () => void
}

/** The "try a question" panel: asks the back end what an agent would retrieve, as a customer or as the business. */
export const useAskKnowledge = (
    workspaceId: string,
    initialModule: AgentModule,
    actions: CommandActions,
): AskKnowledge => {
    const [question, setQuestion] = useState("")
    const [module, setModule] = useState<AgentModule>(initialModule)
    const [audience, setAudience] = useState<AskAudience>("customer")
    const [results, setResults] = useState<ReadonlyArray<RetrievedPassage> | null>(null)
    const [errorKey, setErrorKey] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const ask = () => {
        const text = question.trim().slice(0, 500)
        if (text === "") return
        setErrorKey(null)
        startTransition(async () => {
            const settled = await runCommand(actions, {
                workspaceId,
                kind: "knowledge.ask",
                payload: { question: text, module, audience },
            })
            if (settled.isDone) setResults(passagesOf(settled.result))
            else setErrorKey(commandErrorKey(settled.code))
        })
    }
    return {
        question,
        module,
        audience,
        results,
        errorKey,
        isPending,
        setQuestion,
        setModule: (value) => setModule(AGENT_MODULES.find((key) => key === value) ?? module),
        setAudience: (value) => setAudience(value === "internal" ? "internal" : "customer"),
        ask,
    }
}
