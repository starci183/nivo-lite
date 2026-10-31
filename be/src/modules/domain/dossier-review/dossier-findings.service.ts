import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import type {
    AssignFindingInput,
    ConfirmFindingInput,
    DismissFindingInput,
    FindingFilter,
    FindingPage,
    FindingRecord,
    FindingStatus,
    ReopenFindingInput,
    ResolveFindingInput,
    ReviewSummary,
} from "./dossier-review.contracts"
import { DossierReviewError, DossierReviewErrorCode } from "./errors/dossier-review.error"
import { toDossierReviewRecord, toFindingRecord, toRunRecord } from "./finding-record.mapper"
import { cursorOf, findingPageOf, scopeOf, severityRank } from "./findings-cursor.policy"
import {
    DossierFindingEntity,
    DossierRemedyDraftEntity,
    DossierReviewEntity,
    DossierReviewRunEntity,
} from "./persistence/entities"
import { ReviewInputsService } from "./review-inputs.service"

/** Who may decide on a finding. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The statuses of a finding that still needs work. */
const ACTIVE: ReadonlyArray<FindingStatus> = ["open", "confirmed"]

/** The bounds of a reason or a note people write. */
const NOTE = { min: 3, max: 500 } as const

/** The most rows a summary or a lookup reads. */
const READ_MAX = 500

/** The severity of a finding as a rank, critical first, in SQL. */
const RANK = "CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END"

/** The findings after a cursor: a later rank, or the same rank seen earlier, or the same instant with a smaller id. */
const AFTER =
    "(CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END > :rank OR (CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END = :rank AND (f.lastSeenAt < :at OR (f.lastSeenAt = :at AND f.id < :id))))"

const noteOf = (text: string | null | undefined): string | null => {
    const note = (text ?? "").trim()
    return note.length < NOTE.min || note.length > NOTE.max ? null : note
}

@Injectable()
/** The findings of the dossier review as people work them: listed and summed up for any member, decided by an owner or a manager. */
export class DossierFindingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly members: WorkspaceMembersService,
        private readonly lookup: MemberLookupService,
        private readonly inputs: ReviewInputsService,
    ) {}

    /** One page of findings, the most severe and most recently seen first; rule findings in the reader's locale. */
    async list(userId: string, workspaceId: string, filter: FindingFilter, locale: Locale): Promise<FindingPage> {
        await this.members.require(userId, workspaceId)
        const scope = scopeOf(workspaceId, filter)
        const page = findingPageOf(filter, scope)
        const awaiting =
            filter.draftsAwaiting === true
                ? (
                      await this.entityManager.find(DossierRemedyDraftEntity, {
                          select: { id: true, findingId: true },
                          where: { workspaceId, status: "proposed" },
                          take: READ_MAX,
                      })
                  ).map((draft) => draft.findingId)
                : null
        if (awaiting !== null && awaiting.length === 0)
            return { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } }
        const query = this.entityManager
            .createQueryBuilder(DossierFindingEntity, "f")
            .addSelect(RANK, "severity_rank")
            .where("f.workspaceId = :workspaceId", { workspaceId })
        if (filter.dossierId) query.andWhere("f.dossierId = :dossierId", { dossierId: filter.dossierId })
        if (filter.statuses && filter.statuses.length > 0) {
            query.andWhere("f.status IN (:...statuses)", { statuses: [...filter.statuses] })
        }
        if (filter.severities && filter.severities.length > 0) {
            query.andWhere("f.severity IN (:...severities)", { severities: [...filter.severities] })
        }
        if (filter.assigneeId) query.andWhere("f.assigneeId = :assigneeId", { assigneeId: filter.assigneeId })
        if (filter.unassigned === true) query.andWhere("f.assigneeId IS NULL")
        if (awaiting !== null) query.andWhere("f.id IN (:...awaiting)", { awaiting })
        if (page.after !== null) query.andWhere(AFTER, { ...page.after })
        const rows = await query
            .orderBy("severity_rank", "ASC")
            .addOrderBy("f.lastSeenAt", "DESC")
            .addOrderBy("f.id", "DESC")
            .limit(page.first + 1)
            .getMany()
        const shown = rows.slice(0, page.first)
        const render = await this.renderer(
            workspaceId,
            shown.map((row) => row.id),
            locale,
        )
        const nodes = shown.map(render)
        const last = shown.at(-1)
        return {
            nodes,
            pageInfo: {
                endCursor:
                    last === undefined
                        ? null
                        : cursorOf(
                              { rank: severityRank(last.severity), at: last.lastSeenAt.toISOString(), id: last.id },
                              scope,
                          ),
                hasNextPage: rows.length > page.first,
            },
        }
    }

    /** The review at a glance: active findings by status and severity, drafts to approve, the newest run and the reviewed dossiers. */
    async summary(userId: string, workspaceId: string): Promise<ReviewSummary> {
        await this.members.require(userId, workspaceId)
        const counts = await this.entityManager
            .createQueryBuilder(DossierFindingEntity, "f")
            .select("f.status", "status")
            .addSelect("f.severity", "severity")
            .addSelect("COUNT(*)", "count")
            .where("f.workspaceId = :workspaceId AND f.status IN (:...statuses)", {
                workspaceId,
                statuses: [...ACTIVE],
            })
            .groupBy("f.status")
            .addGroupBy("f.severity")
            .getRawMany<{ status: string; severity: string; count: string | number }>()
        const sum = (keep: (row: { status: string; severity: string }) => boolean): number =>
            counts.filter(keep).reduce((total, row) => total + Number(row.count), 0)
        const draftsAwaiting = await this.entityManager.count(DossierRemedyDraftEntity, {
            where: { workspaceId, status: "proposed" },
        })
        const latest = await this.entityManager.findOne(DossierReviewRunEntity, {
            where: { workspaceId },
            order: { createdAt: "DESC" },
        })
        const isRunning = await this.entityManager.exists(DossierReviewRunEntity, {
            where: { workspaceId, status: In(["queued", "running"]) },
        })
        const reviews = await this.entityManager.find(DossierReviewEntity, { where: { workspaceId }, take: READ_MAX })
        const checklist = new Map((await this.inputs.all(workspaceId)).map((dossier) => [dossier.id, dossier.status]))
        return {
            open: sum((row) => row.status === "open"),
            confirmed: sum((row) => row.status === "confirmed"),
            critical: sum((row) => row.severity === "critical"),
            high: sum((row) => row.severity === "high"),
            draftsAwaiting,
            isRunning,
            latestRun: latest === null ? null : toRunRecord(latest),
            dossiers: reviews.flatMap((review) => {
                const status = checklist.get(review.dossierId)
                return status === undefined ? [] : [toDossierReviewRecord(review, status)]
            }),
        }
    }

    /** Confirms an open finding, with an optional note. */
    confirm(userId: string, workspaceId: string, input: ConfirmFindingInput, locale: Locale): Promise<FindingRecord> {
        return this.decide(userId, workspaceId, input.findingId, ["open"], locale, () => ({
            status: "confirmed",
            decisionNote: noteOf(input.note),
        }))
    }

    /** Dismisses an active finding for a reason of 3 to 500 characters; the evidence it had is kept, so new evidence reopens it. */
    dismiss(userId: string, workspaceId: string, input: DismissFindingInput, locale: Locale): Promise<FindingRecord> {
        const reason = noteOf(input.reason)
        if (reason === null) throw new DossierReviewError({ code: DossierReviewErrorCode.ReasonRequired })
        return this.decide(userId, workspaceId, input.findingId, ACTIVE, locale, (row) => ({
            status: "dismissed",
            dismissReason: reason,
            dismissedEvidenceHash: row.evidenceHash,
            decisionNote: reason,
        }))
    }

    /** Opens a dismissed or resolved finding again. */
    reopen(userId: string, workspaceId: string, input: ReopenFindingInput, locale: Locale): Promise<FindingRecord> {
        return this.decide(userId, workspaceId, input.findingId, ["dismissed", "resolved"], locale, (row) => ({
            status: "open",
            resolution: null,
            resolvedAt: null,
            reopenedCount: row.reopenedCount + 1,
        }))
    }

    /** Marks an active finding done outside NIVO, with a note of 3 to 500 characters of what was done. */
    resolve(userId: string, workspaceId: string, input: ResolveFindingInput, locale: Locale): Promise<FindingRecord> {
        const note = noteOf(input.note)
        if (note === null) throw new DossierReviewError({ code: DossierReviewErrorCode.ReasonRequired })
        return this.decide(userId, workspaceId, input.findingId, ACTIVE, locale, () => ({
            status: "resolved",
            resolution: "manual",
            resolvedAt: this.clock.now(),
            decisionNote: note,
        }))
    }

    /** Gives an active finding to an active member of the workspace (by membership id) with an optional due date, or takes it back. */
    async assign(
        userId: string,
        workspaceId: string,
        input: AssignFindingInput,
        locale: Locale,
    ): Promise<FindingRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        if (input.assigneeId !== null && (await this.lookup.activeById(workspaceId, input.assigneeId)) === null) {
            throw new DossierReviewError({ code: DossierReviewErrorCode.AssigneeNotMember })
        }
        return this.write(workspaceId, input.findingId, ACTIVE, locale, () => ({
            assigneeId: input.assigneeId,
            dueAt: input.dueAt,
        }))
    }

    /** A decision of an owner or a manager on a finding in one of the allowed statuses, recorded with who took it and when. */
    private async decide(
        userId: string,
        workspaceId: string,
        findingId: string,
        allowed: ReadonlyArray<FindingStatus>,
        locale: Locale,
        changes: (row: DossierFindingEntity) => Partial<DossierFindingEntity>,
    ): Promise<FindingRecord> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const memberId = await this.members.idOf(userId, workspaceId)
        return this.write(workspaceId, findingId, allowed, locale, (row) => ({
            ...changes(row),
            decidedBy: memberId,
            decidedAt: this.clock.now(),
        }))
    }

    /** Reads the finding, refuses a status that does not allow the change, and writes it only while the status is still allowed. */
    private async write(
        workspaceId: string,
        findingId: string,
        allowed: ReadonlyArray<FindingStatus>,
        locale: Locale,
        changes: (row: DossierFindingEntity) => Partial<DossierFindingEntity>,
    ): Promise<FindingRecord> {
        const row = await this.entityManager.findOne(DossierFindingEntity, { where: { id: findingId, workspaceId } })
        if (row === null) throw new DossierReviewError({ code: DossierReviewErrorCode.FindingNotFound })
        if (!allowed.includes(row.status))
            throw new DossierReviewError({ code: DossierReviewErrorCode.TransitionRefused })
        const written = await this.entityManager.update(
            DossierFindingEntity,
            { id: findingId, workspaceId, status: In([...allowed]) },
            changes(row),
        )
        if (written.affected === 0) throw new DossierReviewError({ code: DossierReviewErrorCode.TransitionRefused })
        const fresh = await this.entityManager.findOneOrFail(DossierFindingEntity, {
            where: { id: findingId, workspaceId },
        })
        return (await this.renderer(workspaceId, [fresh.id], locale))(fresh)
    }

    /** How findings read for the doors: with their dossier, their latest draft and, for a rule finding, its words in the locale. */
    private async renderer(
        workspaceId: string,
        findingIds: ReadonlyArray<string>,
        locale: Locale,
    ): Promise<(row: DossierFindingEntity) => FindingRecord> {
        const dossiers = new Map((await this.inputs.all(workspaceId)).map((dossier) => [dossier.id, dossier]))
        const drafts =
            findingIds.length === 0
                ? []
                : await this.entityManager.find(DossierRemedyDraftEntity, {
                      select: { id: true, findingId: true, status: true, createdAt: true },
                      where: { workspaceId, findingId: In([...findingIds]) },
                      order: { createdAt: "DESC" },
                      take: READ_MAX,
                  })
        const latestDraft = new Map<string, DossierRemedyDraftEntity>()
        for (const draft of drafts) if (!latestDraft.has(draft.findingId)) latestDraft.set(draft.findingId, draft)
        return (row) =>
            toFindingRecord(row, {
                dossier: row.dossierId === null ? undefined : dossiers.get(row.dossierId),
                draft: latestDraft.get(row.id),
                text:
                    row.origin === "rule" && row.code !== null
                        ? {
                              title: this.catalog.get(`findings.${row.code}.title`, row.params, locale),
                              detail: this.catalog.get(`findings.${row.code}.detail`, row.params, locale),
                          }
                        : { title: row.title, detail: row.detail },
            })
    }
}
