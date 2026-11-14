import { Injectable } from "@nestjs/common"
import { In, Not, type EntityManager } from "typeorm"
import { factSlugOf } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager, returnedRows } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { isGapReturned, toGapFields, toGapRecord, type GapFields } from "./gap-record.mapper"
import { splitTopic } from "./gap-keywords.policy"
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

/** The key of a subject and an attribute as written (`factSlugOf` of each, exact); null when either has no letter or digit. */
const keyOf = (subject: string, attribute: string): string | null => {
    const [left, right] = [factSlugOf(subject), factSlugOf(attribute)]
    return left === "" || right === "" ? null : `${left}|${right}`
}

/** The key of the topic and attribute a gap was reported with, or null when the model gave it none. */
const gapKeyOf = (gap: Pick<KnowledgeGapEntity, "topic" | "attributeGuess">): string | null =>
    gap.topic === null || gap.attributeGuess === null ? null : keyOf(gap.topic, gap.attributeGuess)

@Injectable()
/**
 * The questions customers asked that the brain could not answer. The SAME gap is counted again when the question is the same text
 * (its normal form, exact) or when the model that reported it gave it the same topic and attribute (exact keys of what the model
 * wrote); a truth ANSWERS a gap when its subject and attribute are those same keys; a customer asking again reopens it. No word of a
 * question is compared with another (owner 2026-11-12): what two questions mean is read by the model in the turn that reports them.
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
        return rows.map((item) => toGapRecord(item))
    }

    /**
     * A customer asked something the brain could not answer. The same gap of the same agent counts it again (an answered one opens
     * again): the same question text, or the same topic AND attribute as the model wrote them; otherwise a new gap starts. Answers
     * null when the question has no letter or digit to remember it by.
     */
    async record(workspaceId: string, input: GapInput): Promise<MaybeGapRecorded> {
        const question = input.question.replaceAll(/\s+/g, " ").trim().slice(0, QUESTION_MAX)
        const key = factSlugOf(question)
        if (key === "") return null
        const { subject, attribute } = splitTopic(input.topic)
        const topicKey = subject === null || attribute === null ? null : keyOf(subject, attribute)
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
                (topicKey === null ? undefined : rows.find((row) => gapKeyOf(row) === topicKey))
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
                keywords: [],
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

    /**
     * Answers every open gap whose topic and attribute (as the model that reported it wrote them) are the keys of this truth's
     * subject and attribute. Exact keys only: a gap the model gave no topic is answered by a person. Answers how many.
     */
    async resolve(workspaceId: string, answerer: Answerer): Promise<number> {
        const key = keyOf(answerer.subject, answerer.attribute)
        if (key === null) return 0
        const open = await this.entityManager.find(KnowledgeGapEntity, {
            select: { id: true, module: true, topic: true, attributeGuess: true },
            where: { workspaceId, status: "open" },
            take: CANDIDATES,
        })
        const matching = open.filter(
            (gap) => (answerer.module === null || answerer.module === gap.module) && gapKeyOf(gap) === key,
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
        return { openCount, items: rows.map((item) => toGapRecord(item)) }
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
