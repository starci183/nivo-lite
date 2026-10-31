import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { factSlugOf } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager, returnedRows } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { isGapReturned, toGapFields, toGapRecord } from "./gap-record.mapper"
import type { GapFields } from "./gap-record.mapper"
import { answers, keywordsOf, sameQuestion, splitTopic, wordSet } from "./gap-keywords.policy"
import type {
    Answerer,
    GapInput,
    GapRecord,
    GapRecorded,
    GapStatus,
    MaybeGapRecorded,
    ModuleGaps,
} from "./knowledge-gaps.contracts"
import { KnowledgeGapEntity } from "./persistence/entities"

/** The columns a write answers, named as the entity names them. */
const GAP_RETURNING = `id, module, question, question_key AS "questionKey", keywords, topic, attribute_guess AS "attributeGuess", count,
    first_seen_at AS "firstSeenAt", last_seen_at AS "lastSeenAt", example_conversation_id AS "exampleConversationId", status,
    reopened_count AS "reopenedCount"`

/** The longest question kept. */
const QUESTION_MAX = 300

/** How many gaps are compared with a new question, and how many open gaps an answer is matched against. */
const CANDIDATES = 300

/** The most gaps a list returns. */
const LIST_MAX = 200

@Injectable()
/**
 * The questions customers asked that the brain could not answer: a similar question counts again on the same gap, the owner adds a
 * fact or a document that answers it, and a customer asking it again reopens it. Similar questions are merged by their significant words.
 */
export class KnowledgeGapsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The gaps with these statuses, the most asked first. */
    async list(
        workspaceId: string,
        statuses: ReadonlyArray<GapStatus>,
        limit: number,
    ): Promise<ReadonlyArray<GapRecord>> {
        const rows = await this.entityManager.find(KnowledgeGapEntity, {
            where: { workspaceId, status: In([...statuses]) },
            order: { count: "DESC", lastSeenAt: "DESC" },
            take: Math.min(limit, LIST_MAX),
        })
        return rows.map(toGapRecord)
    }

    /**
     * A customer asked something the brain could not answer. A similar gap of the same agent counts it again (an answered one opens
     * again); otherwise a new gap starts. Answers null when the question has no significant word to remember it by.
     */
    async record(workspaceId: string, input: GapInput): Promise<MaybeGapRecorded> {
        const question = input.question.replace(/\s+/g, " ").trim().slice(0, QUESTION_MAX)
        const keywords = keywordsOf(question)
        if (keywords.length === 0) return null
        const key = factSlugOf(question)
        const { subject, attribute } = splitTopic(input.topic)
        const bump = async (row: GapFields): Promise<GapRecorded> => {
            const changed = await this.countAgain(workspaceId, row.id, subject, attribute, input.conversationId ?? null)
            return { gap: toGapRecord(changed ?? row), isNew: false, reopened: row.status === "answered" }
        }
        const find = async (): Promise<GapFields | undefined> => {
            const rows = await this.entityManager.find(KnowledgeGapEntity, {
                where: { workspaceId, module: input.module },
                order: { lastSeenAt: "DESC" },
                take: CANDIDATES,
            })
            return (
                rows.find((row) => row.questionKey === key) ??
                rows.find((row) => sameQuestion(keywords, row.keywords ?? keywordsOf(row.question)))
            )
        }
        const existing = await find()
        if (existing !== undefined) return bump(existing)
        const inserted = await this.entityManager
            .createQueryBuilder(KnowledgeGapEntity, "kg")
            .insert()
            .values({
                workspaceId,
                module: input.module,
                question,
                questionKey: key,
                keywords,
                topic: subject,
                attributeGuess: attribute,
                exampleConversationId: input.conversationId ?? null,
                source: input.source,
            })
            .orIgnore()
            .returning(GAP_RETURNING)
            .execute()
        const [created] = returnedRows(inserted.raw, isGapReturned)
        if (created !== undefined) return { gap: toGapRecord(toGapFields(created)), isNew: true, reopened: false }
        // Two turns of the same question at once: the second insert lost, so it counts on the first one.
        const again = await find()
        return again === undefined ? null : bump(again)
    }

    /** The owner does not need this answered: it leaves the list for good (the row is kept). */
    async dismiss(workspaceId: string, id: string, by: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeGapEntity,
            { workspaceId, id, status: Not("answered") },
            { status: "dismissed", dismissedAt: () => "now()", dismissedBy: by },
        )
    }

    /** The gap is answered (`by` = "fact:<id>", "document:<id>" or "owner"). */
    async answer(workspaceId: string, id: string, by: string): Promise<void> {
        await this.entityManager.update(
            KnowledgeGapEntity,
            { workspaceId, id, status: "open" },
            { status: "answered", answeredAt: () => "now()", answeredBy: by },
        )
    }

    /** Answers every open gap whose question words the text covers. Answers how many. */
    async resolve(workspaceId: string, answerer: Answerer): Promise<number> {
        const words = wordSet(answerer.text)
        const open = await this.entityManager.find(KnowledgeGapEntity, {
            select: { id: true, module: true, keywords: true, question: true },
            where: { workspaceId, status: "open" },
            take: CANDIDATES,
        })
        const matching = open.filter(
            (gap) =>
                (answerer.module === null || answerer.module === gap.module) &&
                answers(gap.keywords ?? keywordsOf(gap.question), words, answerer.minimum),
        )
        await eachInOrder(matching, (gap) => this.answer(workspaceId, gap.id, answerer.by))
        return matching.length
    }

    /** How many gaps wait for an answer. */
    countOpen(workspaceId: string): Promise<number> {
        return this.entityManager.count(KnowledgeGapEntity, { where: { workspaceId, status: "open" } })
    }

    /** The open gaps of one agent, the most asked first, and how many it has in all. */
    async openOfModule(workspaceId: string, module: string, limit: number): Promise<ModuleGaps> {
        const [rows, openCount] = await Promise.all([
            this.entityManager.find(KnowledgeGapEntity, {
                where: { workspaceId, module, status: "open" },
                order: { count: "DESC", lastSeenAt: "DESC" },
                take: Math.min(limit, LIST_MAX),
            }),
            this.entityManager.count(KnowledgeGapEntity, { where: { workspaceId, module, status: "open" } }),
        ])
        return { openCount, items: rows.map(toGapRecord) }
    }

    /** Counts a question once more in one statement; an answered gap opens again. Answers the changed gap, or undefined when it is gone. */
    private async countAgain(
        workspaceId: string,
        id: string,
        subject: string | null,
        attribute: string | null,
        conversationId: string | null,
    ): Promise<GapFields | undefined> {
        const result = await this.entityManager
            .createQueryBuilder(KnowledgeGapEntity, "kg")
            .update()
            .set({
                count: () => "count + 1",
                lastSeenAt: () => "now()",
                topic: () => "coalesce(topic, :subject)",
                attributeGuess: () => "coalesce(attribute_guess, :attribute)",
                exampleConversationId: () => "coalesce(example_conversation_id, CAST(:conversationId AS uuid))",
                status: () => "CASE WHEN status = 'answered' THEN 'open' ELSE status END",
                answeredAt: () => "CASE WHEN status = 'answered' THEN NULL ELSE answered_at END",
                answeredBy: () => "CASE WHEN status = 'answered' THEN NULL ELSE answered_by END",
                reopenedCount: () => "CASE WHEN status = 'answered' THEN reopened_count + 1 ELSE reopened_count END",
            })
            .where("workspace_id = :workspaceId AND id = :id", { workspaceId, id })
            .setParameters({ subject, attribute, conversationId })
            .returning(GAP_RETURNING)
            .execute()
        const [changed] = returnedRows(result.raw, isGapReturned)
        return changed === undefined ? undefined : toGapFields(changed)
    }
}
