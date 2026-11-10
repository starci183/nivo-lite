import { randomUUID } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { In, IsNull, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { factSlugOf } from "@modules/domain/brain-facts"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BrainLessonsError, BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import { toLessonCandidate } from "./lesson-candidate.mapper"
import type {
    LessonCandidate,
    LessonCandidateInput,
    LessonCandidateKept,
    LessonCandidateStatus,
    LessonFactKey,
    LessonPlace,
} from "./lesson-candidates.contracts"
import { ANSWER_MAX, QUESTION_MAX, groupOf, lessonWordsOf, maskedOf } from "./lesson-candidates.policy"
import { BrainLessonCandidateEntity } from "./persistence/entities"

/** The most candidates of one place a group is looked for in. */
const PLACE_PAGE = 100

/** The most candidates one card stands on. */
const CHANGE_PAGE = 50

/** The slug a truth's key is compared on (one open card per key). */
export const factKeySlugOf = (key: LessonFactKey): string => `${factSlugOf(key.subjectLabel)}|${factSlugOf(key.attributeLabel)}`

@Injectable()
/**
 * The lesson candidates (public.brain_lesson_candidates): every stop of kind ai_report a person answered in free text, kept once per
 * answer, masked (no phone, no e-mail; no customer id at all: a lesson is about the shop's rule), grouped with the earlier candidates
 * of the same gap (same agent, workflow and step, near question words). The learning that drafts and posts a truth lives with the stops;
 * this store only keeps, groups and moves candidates through their states.
 */
export class LessonCandidatesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The answers of a stop already kept, by their time (ISO). */
    async keptOf(workspaceId: string, stopId: string): Promise<ReadonlySet<string>> {
        const rows = await this.entityManager.find(BrainLessonCandidateEntity, {
            select: { id: true, answeredAt: true },
            where: { workspaceId, stopId },
            take: CHANGE_PAGE,
        })
        return new Set(rows.map((row) => toIso(row.answeredAt)))
    }

    /** The candidates of one place since a moment, newest first (index `brain_lesson_candidates_place`). */
    async recent(workspaceId: string, place: LessonPlace, since: Date): Promise<ReadonlyArray<LessonCandidate>> {
        const rows = await this.entityManager.find(BrainLessonCandidateEntity, {
            where: {
                workspaceId,
                agentId: place.agentId,
                stepKey: place.stepKey,
                workflowId: place.workflowId ?? IsNull(),
                answeredAt: MoreThanOrEqual(since),
            },
            order: { answeredAt: "DESC" },
            take: PLACE_PAGE,
        })
        return rows.map(toLessonCandidate)
    }

    /** Keeps one answered stop in the group of its gap (the nearest recent candidate's, else a new group); the same answer once. */
    async keep(workspaceId: string, input: LessonCandidateInput, since: Date): Promise<LessonCandidateKept> {
        const question = maskedOf(input.question, QUESTION_MAX)
        const keywords = lessonWordsOf(question)
        const groupId = groupOf(await this.recent(workspaceId, input, since), keywords) ?? randomUUID()
        const inserted = await this.entityManager
            .createQueryBuilder(BrainLessonCandidateEntity, "lc")
            .insert()
            .values({
                workspaceId,
                stopId: input.stopId,
                runId: input.runId,
                stepKey: input.stepKey,
                agentId: input.agentId,
                workflowId: input.workflowId,
                question,
                keywords,
                answer: maskedOf(input.answer, ANSWER_MAX),
                answeredBy: input.answeredBy,
                answeredAt: new Date(input.answeredAt),
                thenDid: input.thenDid,
                groupId,
            })
            .orIgnore()
            .returning("id")
            .execute()
        const row = await this.entityManager.findOne(BrainLessonCandidateEntity, {
            where: { workspaceId, stopId: input.stopId, answeredAt: new Date(input.answeredAt) },
        })
        if (row === null) throw new BrainLessonsError({ code: BrainLessonsErrorCode.CandidateLost })
        // The unique answer key ignored a second insert of the same answer: RETURNING then answers no row.
        return { candidate: toLessonCandidate(row), isNew: Array.isArray(inserted.raw) && inserted.raw.length > 0 }
    }

    /** Keeps the cheap judgement: whether the words state a general rule. */
    async judged(workspaceId: string, id: string, general: boolean): Promise<void> {
        await this.entityManager.update(BrainLessonCandidateEntity, { workspaceId, id }, { general })
    }

    /** Takes these candidates for one draft (candidate → proposing); true only when every one of them was free. */
    async claim(workspaceId: string, ids: ReadonlyArray<string>): Promise<boolean> {
        const moved = await this.move(workspaceId, ids, ["candidate"], { status: "proposing" })
        if (moved === ids.length) return true
        await this.release(workspaceId, ids)
        return false
    }

    /** Gives claimed candidates back (proposing → candidate): no card was posted. */
    async release(workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        await this.move(workspaceId, ids, ["proposing"], { status: "candidate" })
    }

    /** The candidates a card now stands on (proposing or candidate → proposed), with the card and the truth's key. */
    async proposed(workspaceId: string, ids: ReadonlyArray<string>, changeId: string, key: LessonFactKey): Promise<void> {
        await this.move(workspaceId, ids, ["proposing", "candidate"], {
            status: "proposed",
            changeId,
            factKey: { subjectLabel: key.subjectLabel, attributeLabel: key.attributeLabel },
            factSlug: factKeySlugOf(key),
        })
    }

    /** A candidate the founder already turned down in other words (candidate → declined). */
    async declined(workspaceId: string, ids: ReadonlyArray<string>): Promise<void> {
        await this.move(workspaceId, ids, ["candidate"], { status: "declined" })
    }

    /** The open card of a truth's key, or null: one open card per key. */
    async openOfKey(workspaceId: string, key: LessonFactKey): Promise<string | null> {
        const row = await this.entityManager.findOne(BrainLessonCandidateEntity, {
            select: { id: true, changeId: true },
            where: { workspaceId, factSlug: factKeySlugOf(key), status: "proposed" },
        })
        return row?.changeId ?? null
    }

    /** The changes whose cards are open (status proposed), each once (index `brain_lesson_candidates_fact_open`). */
    async openChanges(workspaceId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(BrainLessonCandidateEntity, {
            select: { id: true, changeId: true },
            where: { workspaceId, status: "proposed" },
            take: CHANGE_PAGE,
        })
        return [...new Set(rows.flatMap((row) => (row.changeId === null ? [] : [row.changeId])))]
    }

    /** The candidates a card stands on. */
    async ofChange(workspaceId: string, changeId: string): Promise<ReadonlyArray<LessonCandidate>> {
        const rows = await this.entityManager.find(BrainLessonCandidateEntity, {
            where: { workspaceId, changeId },
            order: { answeredAt: "ASC" },
            take: CHANGE_PAGE,
        })
        return rows.map(toLessonCandidate)
    }

    /** The founder decided a card: its candidates are learned (with the truth in force), declined, or free again (superseded). */
    async closeChange(
        workspaceId: string,
        changeId: string,
        to: Extract<LessonCandidateStatus, "learned" | "declined" | "candidate">,
        factId: string | null,
    ): Promise<number> {
        const result = await this.entityManager.update(
            BrainLessonCandidateEntity,
            { workspaceId, changeId, status: "proposed" },
            to === "candidate"
                ? { status: to, changeId: null, factKey: null, factSlug: null }
                : { status: to, factId: to === "learned" ? factId : null },
        )
        return result.affected ?? 0
    }

    private async move(
        workspaceId: string,
        ids: ReadonlyArray<string>,
        from: ReadonlyArray<LessonCandidateStatus>,
        values: Partial<Pick<BrainLessonCandidateEntity, "status" | "changeId" | "factKey" | "factSlug">>,
    ): Promise<number> {
        if (ids.length === 0) return 0
        const result = await this.entityManager.update(
            BrainLessonCandidateEntity,
            { workspaceId, id: In([...ids]), status: In([...from]) },
            values,
        )
        return result.affected ?? 0
    }
}

/** A stored instant as ISO text. */
const toIso = (value: Date | string): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString())
