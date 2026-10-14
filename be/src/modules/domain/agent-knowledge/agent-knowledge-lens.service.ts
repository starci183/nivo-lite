import { Injectable } from "@nestjs/common"
import type {
    AgentAudience,
    BaseRule,
    KnowledgeDocument,
    KnowledgeLens,
    LensCounts,
    OptionalId,
    OptionalOpenGaps,
} from "@modules/domain/agents"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { KnowledgeRecallService } from "./knowledge-recall.service"
import { audienceOfModule, viewOf } from "./knowledge-view.policy"

/** The base-knowledge kinds an agent keeps as rules: authority and escalation (AGENTS.md) and tone (SOUL.md). */
const RULE_KINDS: ReadonlySet<string> = new Set(["authority", "escalation", "tone"])
/** The facts counted for a lens. */
const COUNT_LIMIT = 500
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
        private readonly sources: KnowledgeSourcesService,
        private readonly recall: KnowledgeRecallService,
        private readonly nivo: NivoKnowledgeService,
        private readonly gaps: KnowledgeGapsService,
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

    /** The standing memory of the shared brain seen through the lens, as markdown. */
    memoryFor(workspaceId: string, module: string, installationId: OptionalId): Promise<string> {
        return this.recall.standingMemory(viewOf({ workspaceId, module, installationId }))
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
