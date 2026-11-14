"use client"

import { useTranslations } from "next-intl"
import { QUERY_BRAIN_POLICIES_SWR_KEY, useMutateDeriveBrainPoliciesSwr } from "@/hooks/swr"
import type { PolicyDeriveWords } from "@/modules/brain"
import { mutate } from "@/modules/viewer-cache"
import { useFailureToast } from "./useFailureToast"

/** A cache key of the rules: asking for a pass changes their derive state. */
const isPoliciesRead = (key: unknown): boolean =>
    Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(QUERY_BRAIN_POLICIES_SWR_KEY)

/** What the tab needs to ask for a derive pass and to say how one goes. */
interface PolicyDerive {
    readonly words: PolicyDeriveWords
    readonly isPending: boolean
    readonly derive: () => void
}

/**
 * The derive pass of the policies tab: the AI reads the truth graph and picks the shop's policies. Asking only queues the pass (it
 * never waits for the model); the rules are read again at once, and the tab keeps asking while the pass runs. A refused ask is the
 * failure toast.
 */
export const usePolicyDerive = (): PolicyDerive => {
    const p = useTranslations("brainPolicies")
    const fail = useFailureToast()
    const ask = useMutateDeriveBrainPoliciesSwr()
    const derive = async () => {
        if (ask.isMutating) return
        try {
            await ask.trigger()
            await mutate(isPoliciesRead)
        } catch {
            fail()
        }
    }
    return {
        words: {
            derivingTitle: p("derivingTitle"),
            derivingBody: (pendingFacts) =>
                pendingFacts > 0 ? p("derivingBody", { n: pendingFacts }) : p("derivingBodyNone"),
            failedTitle: p("deriveFailedTitle"),
            failedBody: (error) => p(error === "credits" ? "deriveFailedCredits" : "deriveFailedModel"),
        },
        isPending: ask.isMutating,
        derive: () => void derive(),
    }
}
