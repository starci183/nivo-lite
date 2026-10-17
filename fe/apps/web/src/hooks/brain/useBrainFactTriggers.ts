import {
    useMutateDecideBrainFactSwr,
    useMutateDismissKnowledgeGapSwr,
    useMutateKeepCurrentBrainFactSwr,
    useMutateSaveBrainFactSwr,
} from "@/hooks/swr"
import type {
    MutateDecideBrainFactRequest,
    MutateDismissKnowledgeGapRequest,
    MutateKeepCurrentBrainFactRequest,
    MutateSaveBrainFactRequest,
} from "@/hooks/swr"

/** The requests of the commands about facts and questions, by the kind a card names. */
export interface BrainFactRequests {
    readonly "fact.save": MutateSaveBrainFactRequest
    readonly "fact.decide": MutateDecideBrainFactRequest
    readonly "fact.keep": MutateKeepCurrentBrainFactRequest
    readonly "gap.dismiss": MutateDismissKnowledgeGapRequest
}

/** The triggers of the fact and question commands, each typed by its own request. */
export interface BrainFactTriggers {
    readonly isPending: boolean
    readonly triggers: {
        readonly [Kind in keyof BrainFactRequests]: (request: BrainFactRequests[Kind]) => Promise<unknown>
    }
}

/** The SWR mutations behind the commands that save, decide and keep facts and dismiss open questions. */
export const useBrainFactTriggers = (): BrainFactTriggers => {
    const saveFact = useMutateSaveBrainFactSwr()
    const decideFact = useMutateDecideBrainFactSwr()
    const keepFact = useMutateKeepCurrentBrainFactSwr()
    const dismissGap = useMutateDismissKnowledgeGapSwr()
    return {
        isPending: saveFact.isMutating || decideFact.isMutating || keepFact.isMutating || dismissGap.isMutating,
        triggers: {
            "fact.save": saveFact.trigger,
            "fact.decide": decideFact.trigger,
            "fact.keep": keepFact.trigger,
            "gap.dismiss": dismissGap.trigger,
        },
    }
}
