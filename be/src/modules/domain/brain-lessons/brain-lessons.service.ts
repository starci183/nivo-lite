import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { BrainLessonsError, BrainLessonsErrorCode } from "./errors/brain-lessons.error"
import { toLessonRecord } from "./lesson-record.mapper"
import type { LessonInput, LessonRecord, LessonStatus, LessonVerdict } from "./brain-lessons.contracts"
import type { BrainLessonRow, LessonVersionRow } from "./persistence/brain-lessons.rows"
import {
    DECIDE_LESSON,
    INSERT_LESSON,
    RETIRE_LESSON,
    RETIRE_SUPERSEDED,
    SELECT_LESSONS,
    SELECT_LESSON_VERSION,
} from "./persistence/brain-lessons.sql"

@Injectable()
/**
 * Lessons: how an agent should work. Proposed from the owner's edits, notes or outcomes, approved by an owner or manager, versioned
 * (a new version retires the old one when approved). Only ACTIVE lessons reach an agent.
 */
export class BrainLessonsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The lessons with these statuses (all when none is given), newest first. */
    async list(workspaceId: string, statuses?: ReadonlyArray<LessonStatus>): Promise<ReadonlyArray<LessonRecord>> {
        const rows = await this.entityManager.query<Array<BrainLessonRow>>(SELECT_LESSONS, [workspaceId, statuses ?? null])
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
                ? []
                : await this.entityManager.query<Array<LessonVersionRow>>(SELECT_LESSON_VERSION, [workspaceId, replaced])
        const [row] = await this.entityManager.query<Array<BrainLessonRow>>(INSERT_LESSON, [
            workspaceId,
            input.module,
            title,
            body,
            input.appliesWhen?.trim() ?? "",
            input.origin,
            JSON.stringify(input.evidence ?? []),
            (previous[0]?.version ?? 0) + 1,
            replaced,
            input.proposedBy,
        ])
        const lesson = toLessonRecord(row ?? this.missing())
        return input.apply === true ? this.decide(workspaceId, lesson.id, "active", input.proposedBy) : lesson
    }

    /** Approves (active) or turns down (rejected) a proposal; approving a new version retires the one it replaces. */
    async decide(workspaceId: string, id: string, to: LessonVerdict, decidedBy: string): Promise<LessonRecord> {
        const [row] = await this.entityManager.query<Array<BrainLessonRow>>(DECIDE_LESSON, [workspaceId, id, to, decidedBy])
        if (row === undefined) throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotProposed })
        if (to === "active" && row.supersedes_id !== null) {
            await this.entityManager.query(RETIRE_SUPERSEDED, [workspaceId, row.supersedes_id])
        }
        return toLessonRecord(row)
    }

    /** The lesson was not written: it cannot be proposed again for the same reason. */
    private missing(): never {
        throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotProposed })
    }

    /** Stops an active lesson. */
    async retire(workspaceId: string, id: string, decidedBy: string): Promise<LessonRecord> {
        const [row] = await this.entityManager.query<Array<BrainLessonRow>>(RETIRE_LESSON, [workspaceId, id, decidedBy])
        if (row === undefined) throw new BrainLessonsError({ code: BrainLessonsErrorCode.NotActive })
        return toLessonRecord(row)
    }
}
