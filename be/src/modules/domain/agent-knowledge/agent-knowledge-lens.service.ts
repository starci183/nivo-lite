import { Injectable } from "@nestjs/common"
import type {
    AgentAudience,
    AskAsAgentInput,
    AskedPassage,
    BaseRule,
    KnowledgeDocument,
    KnowledgeLens,
    LensCounts,
    LensLanes,
    OptionalId,
    OptionalOpenGaps,
} from "@modules/domain/agents"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesReadableService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import type { AgentNotesRequest } from "./agent-knowledge.contracts"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { CUSTOMER_MODULE, lanesOfView } from "./knowledge-lanes.policy"
import { audienceOfModule, viewOf } from "./knowledge-view.policy"

/** The base-knowledge kinds an agent keeps as rules: authority and escalation (AGENTS.md) and tone (SOUL.md). */
const RULE_KINDS: ReadonlySet<string> = new Set(["authority", "escalation", "tone"])
/** The facts counted for a lens. */
const COUNT_LIMIT = 500
/** How many facts one question gets back. */
const FACT_LIMIT = 5
/** The longest question that is searched. */
const QUESTION_MAX_CHARS = 500
/** The layer of a result row that is a confirmed fact of the brain. */
const FACT_LAYER = "fact"

/** A fact as a result row: its scope is the visibility, and it has no document or place in one. */
const factRow = (fact: FactRecord, module: string): AskedPassage => ({
    layer: FACT_LAYER,
    id: fact.id,
    sourceId: null,
    module,
    kind: FACT_LAYER,
    title: `${fact.subjectLabel} · ${fact.attributeLabel}`,
    content: fact.unit === null ? fact.value : `${fact.value} ${fact.unit}`,
    score: 1,
    visibility: fact.scope,
    topic: null,
    order: null,
})

/** The Postgres code of a relation that does not exist: the gaps are not kept in this database. */
const UNDEFINED_TABLE = "42P01"

/** True when a database failure says the table is missing. */
const isMissingTable = (cause: unknown): boolean => {
    if (typeof cause !== "object" || cause === null) return false
    const driver: unknown = Reflect.get(cause, "driverError")
    const code: unknown =
        typeof driver === "object" && driver !== null ? Reflect.get(driver, "code") : Reflect.get(cause, "code")
    return code === UNDEFINED_TABLE
}

@Injectable()
/**
 * The business knowledge an agent reads through its lens (module, audience and instance): the indexed documents, the standing memory
 * of the shared brain, the NIVO base rules of its folders, what the lens can read counted, and the questions it could not answer.
 * A customer-facing module never sees an internal document or fact.
 */
export class AgentKnowledgeLensService implements KnowledgeLens {
    constructor(
        private readonly sources: KnowledgeSourcesReadableService,
        private readonly recall: KnowledgeRecallService,
        private readonly nivo: NivoKnowledgeService,
        private readonly gaps: KnowledgeGapsService,
        private readonly search: KnowledgeSearchService,
    ) {}

    /** Who the module talks to. */
    audienceOf(module: string): AgentAudience {
        return audienceOfModule(module)
    }

    /** Up to `limit` indexed documents the lens of the module (and instance) may read, oldest first. */
    async sourcesFor(
        workspaceId: string,
        module: string,
        installationId: OptionalId,
        limit: number,
    ): Promise<ReadonlyArray<KnowledgeDocument>> {
        const view = viewOf({ workspaceId, module, installationId })
        const found = await this.sources.readableFor(view, limit)
        return found.map((source) => ({
            title: source.title,
            topic: source.topic,
            kind: source.kind,
            visibility: source.visibility,
            updatedAt: source.updatedAt,
            content: source.content,
        }))
    }

    /** The authority, escalation and tone rules of the folders, the module's own before core, then by slug. */
    async baseRulesOf(folders: ReadonlyArray<string>): Promise<ReadonlyArray<BaseRule>> {
        const rank = (module: string): number => folders.indexOf(module)
        const items = await this.nivo.list()
        const rules = items.filter((item) => folders.includes(item.module) && RULE_KINDS.has(item.kind))
        return [...rules]
            .sort((a, b) => rank(a.module) - rank(b.module) || a.slug.localeCompare(b.slug))
            .map((item) => ({ title: item.title, body: item.body, kind: item.kind }))
    }

    /** What the lens can read, counted: documents by visibility (no internal ones for a customer lens) and facts by scope. */
    async countsFor(workspaceId: string, module: string, installationId: OptionalId): Promise<LensCounts> {
        const view = viewOf({ workspaceId, module, installationId })
        const [publicDocs, internalDocs, facts] = await Promise.all([
            this.sources.countReadable(view, "public"),
            this.sources.countReadable(view, "internal"),
            this.recall.factsInView(view, COUNT_LIMIT),
        ])
        const byScope = (scope: string): number => facts.filter((fact) => fact.scope === scope).length
        return {
            audience: view.audience,
            documents: { public: publicDocs, internal: internalDocs },
            facts: { public: byScope("public"), internal: byScope("internal"), restricted: byScope("restricted") },
        }
    }

    /**
     * Tries a question as an agent: the passages the view reads, then the confirmed facts of the same view (module, audience and
     * instance go through the one view policy). The search proves the membership and the module first; a blank question finds nothing.
     */
    async ask(userId: string, workspaceId: string, input: AskAsAgentInput): Promise<ReadonlyArray<AskedPassage>> {
        const passages = await this.search.ask(userId, workspaceId, input)
        const question = input.question.trim().slice(0, QUESTION_MAX_CHARS)
        if (question === "") return passages
        const view = viewOf({
            workspaceId,
            module: input.module,
            audience: input.audience === "customer" ? "customer" : "internal",
            installationId: input.installationId ?? null,
        })
        const facts = await this.recall.factsMatching(view, question, FACT_LIMIT)
        return [...facts.map((fact) => factRow(fact, input.module)), ...passages]
    }

    /**
     * The business notes a task the system runs for an agent retrieves (a drafted follow-up, a thank-you): the same lane as `ask`
     * (the facts of the view, then the passages the view allows), without a member asking. A customer-facing text passes the
     * customer audience and so never reads an internal document or fact; a blank question finds nothing.
     */
    async notes(request: AgentNotesRequest): Promise<ReadonlyArray<AskedPassage>> {
        const question = request.question.trim().slice(0, QUESTION_MAX_CHARS)
        const passages = await this.search.forAgent({ ...request, question })
        if (question === "") return passages
        const facts = await this.recall.factsMatching(viewOf(request), question, FACT_LIMIT)
        return [...facts.map((fact) => factRow(fact, request.module)), ...passages].slice(0, request.limit)
    }

    /** Which kinds of knowledge the view of the module reads, by the same policy that builds the view. */
    lanesOf(module: string): LensLanes {
        return lanesOfView(module)
    }

    /** Which kinds of knowledge the public's view reads, by the same policy. */
    customerLanes(): LensLanes {
        return lanesOfView(CUSTOMER_MODULE, "customer")
    }

    /** Up to `limit` open questions of the module, most asked first; null only when the gaps are not kept at all. */
    async openGapsOf(workspaceId: string, module: string, limit: number): Promise<OptionalOpenGaps> {
        try {
            return await this.readGaps(workspaceId, module, limit)
        } catch (cause) {
            if (isMissingTable(cause)) return null
            throw cause
        }
    }

    private async readGaps(workspaceId: string, module: string, limit: number): Promise<OptionalOpenGaps> {
        const open = await this.gaps.openOfModule(workspaceId, module, limit)
        return {
            openCount: open.openCount,
            items: open.items.map((gap) => ({
                id: gap.id,
                question: gap.question,
                count: gap.count,
                lastSeenAt: gap.lastSeenAt,
            })),
        }
    }
}
