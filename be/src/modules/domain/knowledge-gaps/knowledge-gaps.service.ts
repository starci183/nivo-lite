import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { keyOf } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { toGapRecord } from "./gap-record.mapper"
import { answers, keywordsOf, sameQuestion, splitTopic, wordSet } from "./gap-keywords.policy"
import type {
    Answerer,
    GapInput,
    GapRecord,
    GapRecorded,
    GapStatus,
    MaybeGapRecorded,
} from "./knowledge-gaps.contracts"
import type { KnowledgeGapRow, OpenCountRow } from "./persistence/knowledge-gaps.rows"
import {
    ANSWER_GAP,
    BUMP_GAP,
    COUNT_OPEN_GAPS,
    DISMISS_GAP,
    INSERT_GAP,
    SELECT_GAPS,
    SELECT_GAP_CANDIDATES,
    SELECT_OPEN_GAPS,
} from "./persistence/knowledge-gaps.sql"

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
        const rows = await this.entityManager.query<Array<KnowledgeGapRow>>(SELECT_GAPS, [
            workspaceId,
            statuses,
            Math.min(limit, LIST_MAX),
        ])
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
        const key = keyOf(question)
        const { subject, attribute } = splitTopic(input.topic)
        const bump = async (row: KnowledgeGapRow): Promise<GapRecorded> => {
            const [changed = row] = await this.entityManager.query<Array<KnowledgeGapRow>>(BUMP_GAP, [
                workspaceId,
                row.id,
                subject,
                attribute,
                input.conversationId ?? null,
            ])
            return { gap: toGapRecord(changed), isNew: false, reopened: row.status === "answered" }
        }
        const find = async (): Promise<KnowledgeGapRow | undefined> => {
            const rows = await this.entityManager.query<Array<KnowledgeGapRow>>(SELECT_GAP_CANDIDATES, [
                workspaceId,
                input.module,
                CANDIDATES,
            ])
            return (
                rows.find((row) => row.question_key === key) ??
                rows.find((row) => sameQuestion(keywords, row.keywords ?? keywordsOf(row.question)))
            )
        }
        const existing = await find()
        if (existing !== undefined) return bump(existing)
        const [created] = await this.entityManager.query<Array<KnowledgeGapRow>>(INSERT_GAP, [
            workspaceId,
            input.module,
            question,
            key,
            keywords,
            subject,
            attribute,
            input.conversationId ?? null,
            input.source,
        ])
        if (created !== undefined) return { gap: toGapRecord(created), isNew: true, reopened: false }
        // Two turns of the same question at once: the second insert lost, so it counts on the first one.
        const again = await find()
        return again === undefined ? null : bump(again)
    }

    /** The owner does not need this answered: it leaves the list for good (the row is kept). */
    async dismiss(workspaceId: string, id: string, by: string): Promise<void> {
        await this.entityManager.query(DISMISS_GAP, [workspaceId, id, by])
    }

    /** The gap is answered (`by` = "fact:<id>", "document:<id>" or "owner"). */
    async answer(workspaceId: string, id: string, by: string): Promise<void> {
        await this.entityManager.query(ANSWER_GAP, [workspaceId, id, by])
    }

    /** Answers every open gap whose question words the text covers. Answers how many. */
    async resolve(workspaceId: string, answerer: Answerer): Promise<number> {
        const words = wordSet(answerer.text)
        const open = await this.entityManager.query<Array<KnowledgeGapRow>>(SELECT_OPEN_GAPS, [workspaceId, CANDIDATES])
        const matching = open.filter(
            (gap) =>
                (answerer.module === null || answerer.module === gap.module) &&
                answers(gap.keywords ?? keywordsOf(gap.question), words, answerer.minimum),
        )
        await eachInOrder(matching, (gap) => this.answer(workspaceId, gap.id, answerer.by))
        return matching.length
    }

    /** How many gaps wait for an answer. */
    async countOpen(workspaceId: string): Promise<number> {
        const [row] = await this.entityManager.query<Array<OpenCountRow>>(COUNT_OPEN_GAPS, [workspaceId])
        return row?.total ?? 0
    }
}
