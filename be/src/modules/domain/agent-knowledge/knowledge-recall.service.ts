import { Injectable } from "@nestjs/common"
import { BrainFactsService, factLine } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import type { LessonRecord } from "@modules/domain/brain-lessons"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentKnowledgeLogEvent } from "./agent-knowledge.log-events"
import type { KnowledgeView, RecallLimits, Recalled } from "./agent-knowledge.contracts"
import { clip, withinBudget } from "./knowledge-view.policy"

/** The whole view of facts is read at most this many at a time; a workspace keeps a few hundred. */
const VIEW_LIMIT = 500
/** The longest passage text one line of a brief carries. */
const PASSAGE_LINE_MAX = 400
/** The default limits of a per-turn recall. */
const TURN_LIMITS: RecallLimits = { facts: 5, passages: 4, budget: 1500 }
/** The language of the synced workspace files the standing memory goes into. */
const BUNDLE_LOCALE: Locale = "vi"
/** The default characters of the standing memory a synced agent keeps. */
const MEMORY_BUDGET = 6000

@Injectable()
/**
 * Recall: what one agent should know for one question, read only through its view. The confirmed brain facts come first (they outrank
 * the documents when they disagree), then the business passages closest to the question. Never throws: a prompt without knowledge is
 * still safe, and the reply contract forbids inventing what is not written.
 */
export class KnowledgeRecallService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly facts: BrainFactsService,
        private readonly lessons: BrainLessonsService,
        private readonly search: KnowledgeSearchService,
    ) {}

    /** Every fact in force inside the view, up to `limit`. */
    async factsInView(view: KnowledgeView, limit: number): Promise<ReadonlyArray<FactRecord>> {
        const all = await this.facts.forView(
            view.workspaceId,
            view.audience,
            view.module,
            view.installationId,
            VIEW_LIMIT,
        )
        return all.slice(0, limit)
    }

    /** The facts in force inside the view that best match a question. */
    factsMatching(view: KnowledgeView, query: string, limit: number): Promise<ReadonlyArray<FactRecord>> {
        return this.facts.search(view.workspaceId, view.audience, view.module, view.installationId, query, limit)
    }

    /** The per-turn block for one question, with the passages it quotes; an empty brief when nothing matched. */
    async recall(view: KnowledgeView, query: string, limits: RecallLimits = TURN_LIMITS): Promise<Recalled> {
        const [facts, passages] = await Promise.all([
            this.factsMatching(view, query, limits.facts).catch((cause: unknown) =>
                this.skip(cause, view, "facts", []),
            ),
            this.search
                .passages(view, query, limits.passages)
                .then((found) => found.filter((passage) => passage.layer === "business"))
                .catch((cause: unknown) => this.skip(cause, view, "passages", [])),
        ])
        const factLines = withinBudget(
            facts.map((fact) => `- ${factLine(fact)}`),
            limits.budget,
        )
        const left = limits.budget - factLines.join("").length
        const passageLines = withinBudget(
            passages.map(
                (passage) => `- ${passage.title}: ${clip(passage.content.replace(/\s+/g, " "), PASSAGE_LINE_MAX)}`,
            ),
            left,
        )
        if (factLines.length === 0 && passageLines.length === 0) return { brief: "", passages: [] }
        const brief = [
            "BUSINESS KNOWLEDGE (use only what is here; never invent a price, policy, date or promise that is not written):",
            factLines.length > 0 ? `Confirmed facts:\n${factLines.join("\n")}` : "",
            passageLines.length > 0 ? `From the business documents:\n${passageLines.join("\n")}` : "",
        ]
            .filter((part) => part !== "")
            .join("\n")
        return { brief, passages: passages.slice(0, passageLines.length) }
    }

    /** The standing part of an agent's memory for its synced workspace: every fact of its view, grouped by subject, and its approved lessons. */
    async standingMemory(view: KnowledgeView, budget: number = MEMORY_BUDGET): Promise<string> {
        const [facts, lessons] = await Promise.all([
            this.factsInView(view, VIEW_LIMIT),
            this.lessons.forModule(view.workspaceId, view.module),
        ])
        const sections = [this.factSection(facts, budget), this.lessonSection(lessons)].filter((part) => part !== "")
        return sections.join("\n\n")
    }

    private factSection(facts: ReadonlyArray<FactRecord>, budget: number): string {
        if (facts.length === 0) return ""
        const subjects = facts.reduce<ReadonlyMap<string, ReadonlyArray<FactRecord>>>(
            (groups, fact) => new Map([...groups, [fact.subjectKey, [...(groups.get(fact.subjectKey) ?? []), fact]]]),
            new Map(),
        )
        const blocks = [...subjects.values()].map((group) => {
            const lines = group.map((fact) => `- ${fact.attributeLabel}: ${fact.value}`).join("\n")
            return `### ${group[0]?.subjectLabel ?? ""}\n${lines}`
        })
        return this.catalog.get(
            "bundle.memoryFacts",
            { body: withinBudget(blocks, budget).join("\n\n") },
            BUNDLE_LOCALE,
        )
    }

    private lessonSection(lessons: ReadonlyArray<LessonRecord>): string {
        if (lessons.length === 0) return ""
        const lines = lessons.map((lesson) => {
            const when =
                lesson.appliesWhen.trim() === ""
                    ? ""
                    : this.catalog.get("bundle.memoryWhen", { when: lesson.appliesWhen }, BUNDLE_LOCALE)
            return `- ${lesson.title}: ${lesson.body}${when}`
        })
        return this.catalog.get("bundle.memoryLessons", { body: lines.join("\n") }, BUNDLE_LOCALE)
    }

    private skip<T>(cause: unknown, view: KnowledgeView, part: string, fallback: T): T {
        this.logger.error(AgentKnowledgeLogEvent.RecallPartFailed, cause, { workspaceId: view.workspaceId, part })
        return fallback
    }
}
