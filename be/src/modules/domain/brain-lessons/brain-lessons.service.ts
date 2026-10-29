import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BrainLessonsError, BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import { toLessonRecord } from "./lesson-record.mapper"
import type { LessonInput, LessonRecord, LessonStatus, LessonVerdict } from "./brain-lessons.contracts"
import { BrainLessonEntity } from "./persistence/entities"

/** The columns a write answers, named as the entity properties so the answer reads as an entity. */
const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    "module",
    "title",
    "body",
    'applies_when AS "appliesWhen"',
    "status",
    "origin",
    "evidence",
    "version",
    'supersedes_id AS "supersedesId"',
    'proposed_by AS "proposedBy"',
    'proposed_at AS "proposedAt"',
    'decided_by AS "decidedBy"',
    'decided_at AS "decidedAt"',
].join(", ")

/** True when a RETURNING row names the key of a stored lesson, the shape the returned columns give it. */
const isBrainLessonEntity = (value: unknown): value is BrainLessonEntity =>
    typeof value === "object" && value !== null && typeof Reflect.get(value, "id") === "string"

/** The rows a write answered. */
const returnedLessons = (raw: unknown): Array<BrainLessonEntity> =>
    Array.isArray(raw) ? raw.filter(isBrainLessonEntity) : []

@Injectable()
/**
 * Lessons: how an agent should work. Proposed from the owner's edits, notes or outcomes, approved by an owner or manager, versioned
 * (a new version retires the old one when approved). Only ACTIVE lessons reach an agent.
 */
export class BrainLessonsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The lessons with these statuses (all when none is given), newest first. */
    async list(workspaceId: string, statuses?: ReadonlyArray<LessonStatus>): Promise<ReadonlyArray<LessonRecord>> {
        const rows = await this.entityManager.find(BrainLessonEntity, {
            where: statuses === undefined ? { workspaceId } : { workspaceId, status: In(statuses) },
            order: { proposedAt: "DESC" },
            take: 500,
        })
        return rows.map(toLessonRecord)
    }

    /** The active lessons one agent follows: its own and the shared ones. */
    async forModule(workspaceId: string, module: string): Promise<ReadonlyArray<LessonRecord>> {
        const active = await this.list(workspaceId, ["active"])
        return active.filter((lesson) => lesson.module === null || lesson.module === module)
    }

    /** Proposes a lesson; a person writing one by hand applies it at once. */
    async propose(workspaceId: string, input: LessonInput): Promise<LessonRecord> {
        const title = input.title.trim().slice(0, 160)
        const body = input.body.trim().slice(0, 2000)
        if (title === "" || body === "") throw new BrainLessonsError({ code: BrainLessonsErrorCode.Incomplete })
        const replaced = input.supersedesId ?? null
        const previous =
            replaced === null
                ? null
                : await this.entityManager.findOne(BrainLessonEntity, {
                      select: { version: true },
                      where: { workspaceId, id: replaced },
                  })
        const inserted = await this.entityManager
            .createQueryBuilder(BrainLessonEntity, "bl")
            .insert()
            .values({
                workspaceId,
                module: input.module,
                title,
                body,
                appliesWhen: input.appliesWhen?.trim() ?? "",
                status: "proposed",
                origin: input.origin,
                evidence: [...(input.evidence ?? [])],
                version: (previous?.version ?? 0) + 1,
                supersedesId: replaced,
                proposedBy: input.proposedBy,
            })
            .returning(RETURNED)
            .execute()
        const [row] = returnedLessons(inserted.raw)
        if (row === undefined) throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotProposed })
        const lesson = toLessonRecord(row)
        return input.apply === true ? this.decide(workspaceId, lesson.id, "active", input.proposedBy) : lesson
    }

    /** Approves (active) or turns down (rejected) a proposal; approving a new version retires the one it replaces. */
    async decide(workspaceId: string, id: string, to: LessonVerdict, decidedBy: string): Promise<LessonRecord> {
        const decided = await this.entityManager
            .createQueryBuilder(BrainLessonEntity, "bl")
            .update()
            .set({ status: to, decidedBy, decidedAt: () => "now()" })
            .where({ workspaceId, id, status: "proposed" })
            .returning(RETURNED)
            .execute()
        const [row] = returnedLessons(decided.raw)
        if (row === undefined) throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotProposed })
        if (to === "active" && row.supersedesId !== null) {
            await this.entityManager.update(
                BrainLessonEntity,
                { workspaceId, id: row.supersedesId, status: "active" },
                { status: "retired" },
            )
        }
        return toLessonRecord(row)
    }

    /** Stops an active lesson. */
    async retire(workspaceId: string, id: string, decidedBy: string): Promise<LessonRecord> {
        const retired = await this.entityManager
            .createQueryBuilder(BrainLessonEntity, "bl")
            .update()
            .set({ status: "retired", decidedBy, decidedAt: () => "now()" })
            .where({ workspaceId, id, status: "active" })
            .returning(RETURNED)
            .execute()
        const [row] = returnedLessons(retired.raw)
        if (row === undefined) throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotActive })
        return toLessonRecord(row)
    }
}
