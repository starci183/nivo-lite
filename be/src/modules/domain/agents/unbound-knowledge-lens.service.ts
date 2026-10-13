import { Injectable } from "@nestjs/common"
import type { Audience, LensCounts, OptionalOpenGaps } from "./agents.contracts"
import type { BaseRule, KnowledgeDocument, KnowledgeLens } from "./agents.port"

const NO_COUNTS: LensCounts = {
    audience: "internal",
    documents: { public: 0, internal: 0 },
    facts: { public: 0, internal: 0, restricted: 0 },
}

@Injectable()
/** The knowledge lens of an app whose knowledge lane has not landed: an agent reads nothing. */
export class UnboundKnowledgeLensService implements KnowledgeLens {
    /** Every module talks to the team until the lens knows better. */
    audienceOf(): Audience {
        return "internal"
    }

    /** No source is readable yet. */
    sourcesFor(): Promise<ReadonlyArray<KnowledgeDocument>> {
        return Promise.resolve([])
    }

    /** No memory is kept yet. */
    memoryFor(): Promise<string> {
        return Promise.resolve("")
    }

    /** No base rule is kept yet. */
    baseRulesOf(): Promise<ReadonlyArray<BaseRule>> {
        return Promise.resolve([])
    }

    /** Nothing is counted yet. */
    countsFor(): Promise<LensCounts> {
        return Promise.resolve(NO_COUNTS)
    }

    /** No gap is tracked yet. */
    openGapsOf(): Promise<OptionalOpenGaps> {
        return Promise.resolve(null)
    }
}
