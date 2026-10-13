import { useCallback, useRef, useState } from "react"
import { useMutateRequestAgentGenerationSwr, useQueryAgentGenerationStatusSwr } from "@/hooks/swr"
import type { AgentGenerationStatusType } from "@/modules/api"
import { busyReply, guidePrompt, mapAnswer, modelAnswer } from "@/modules/guide"
import type { GuideReply, GuideTurn } from "@/modules/guide"
import { useGraphQLWithToast } from "@/modules/toast"
import { useGuideText } from "./useGuideText"

/** One line of the conversation: the member question or the guide reply. */
type GuideConversationMessage =
    | { readonly id: number; readonly role: "user"; readonly text: string }
    | { readonly id: number; readonly role: "guide"; readonly reply: GuideReply }

/** A question the model is answering: the queued text and the role it was asked for. */
interface PendingAnswer {
    readonly generationId: string
    readonly isManager: boolean
}

const MODEL_TIMEOUT_MS = 25_000

/** The turns the model sees, from the conversation so far. */
const historyOf = (messages: ReadonlyArray<GuideConversationMessage>): Array<GuideTurn> =>
    messages.map((message) =>
        message.role === "user" ? { role: "user", text: message.text } : { role: "guide", text: message.reply.answer },
    )

/**
 * The NIVO guide conversation. A question that clearly names a place is answered from the site map at once (no tokens); anything else
 * is queued on the be text door under the usage kind `guide` (paid by NIVO, never counted toward the workspace allowance) and polled
 * until the model answers.
 */
export const useGuideConversation = (isManager: boolean) => {
    const text = useGuideText()
    const runGraphQL = useGraphQLWithToast()
    const { trigger } = useMutateRequestAgentGenerationSwr()
    const [messages, setMessages] = useState<ReadonlyArray<GuideConversationMessage>>([])
    const [isAsking, setIsAsking] = useState(false)
    const [pending, setPending] = useState<PendingAnswer | null>(null)
    const lastId = useRef(0)
    const nextId = useCallback(() => {
        lastId.current = Math.max(lastId.current + 1, Date.now())
        return lastId.current
    }, [])

    const answer = useCallback(
        (reply: GuideReply) => {
            const id = nextId()
            setMessages((current) => [...current, { id, role: "guide", reply }])
            setIsAsking(false)
            setPending(null)
        },
        [nextId],
    )

    const settle = useCallback(
        (generation: AgentGenerationStatusType) => {
            const output = generation.status === "done" ? (generation.output ?? null) : null
            answer(modelAnswer(output, pending?.isManager ?? isManager, text))
        },
        [answer, pending, isManager, text],
    )
    useQueryAgentGenerationStatusSwr(pending?.generationId, settle)

    const ask = useCallback(
        async (question: string, path: string) => {
            const asked = question.trim()
            if (asked === "" || isAsking) return
            const input = { question: asked, path, history: historyOf(messages), isManager }
            const id = nextId()
            setMessages((current) => [...current, { id, role: "user", text: asked }])
            const fromMap = mapAnswer(input, text)
            if (fromMap !== null) {
                answer(fromMap)
                return
            }
            setIsAsking(true)
            const queued = await runGraphQL(
                () =>
                    trigger({
                        purpose: "guide",
                        kind: "guide",
                        module: "other",
                        responseFormat: "json",
                        timeoutMs: MODEL_TIMEOUT_MS,
                        messages: guidePrompt(input, text).map((line) => ({ role: line.role, content: line.content })),
                    }),
                { showSuccessToast: false },
            )
            if (queued?.ok === true && queued.generationId !== null && queued.generationId !== undefined) {
                setPending({ generationId: queued.generationId, isManager })
                return
            }
            answer(busyReply(text))
        },
        [isAsking, messages, isManager, text, answer, nextId, runGraphQL, trigger],
    )

    const restart = useCallback(() => {
        setMessages([])
        setPending(null)
        setIsAsking(false)
    }, [])

    return { messages, isAsking, ask, restart }
}
