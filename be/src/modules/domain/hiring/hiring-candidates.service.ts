import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { CvStorage } from "./cv-storage.port"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { ApplicationSource, CandidateRecord, DeletedCandidates, JobRecord } from "./hiring.contracts"
import type {
    CandidateCvOutput,
    CandidateCvParams,
    DeleteCandidateOutput,
    DeleteCandidateParams,
    LinkStaffOutput,
    LinkStaffParams,
    MoveCandidateOutput,
    MoveCandidateParams,
    SaveNotesParams,
    ToggleOnboardingParams,
} from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringScreeningService } from "./hiring-screening.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import {
    DELETE_CANDIDATES,
    FILL_CHECK,
    LINK_STAFF,
    MOVE_CANDIDATE,
    SAVE_NOTES,
    SUBMIT_APPLICATION,
    TOGGLE_ONBOARDING,
} from "./persistence/hiring.sql"
import type { FilledRow, FlagRow, PathsRow, StaffLinkRow, SubmitRow } from "./persistence/hiring.rows"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { checkApplication, openingRefusal } from "./policies/application.policy"
import type { ApplicationInput } from "./policies/application.policy"
import { findFairnessViolations } from "./policies/fairness.policy"
import { isStage } from "./policies/row-mappers.policy"

const CLOSED_STAGES: ReadonlySet<string> = new Set(["rejected", "withdrawn", "hired"])
const REASON_MIN = 3
const REASON_MAX = 300
const NOTES_MAX = 4000

/** A CV file that was uploaded to the store before the application was sent. */
export interface StoredCv {
    /** The path in the store. */
    readonly path: string
    /** The file name shown. */
    readonly name: string
    /** The media type. */
    readonly mime: string
    /** The size in bytes; zero when unknown. */
    readonly size: number
}

/** What comes with an application besides what the applicant typed. */
export interface ApplicationExtras {
    /** The chat conversation of a chat application. */
    readonly conversationId?: string
    /** The CV file already stored under the job folder. */
    readonly cv?: StoredCv
    /** The hash of the applicant address, kept with the consent. */
    readonly ipHash?: string
}

/** What storing an application answered. */
export interface SubmittedApplication {
    /** The candidate. */
    readonly candidateId: string
    /** True when the same phone had already applied for the job. */
    readonly duplicate: boolean
}

@Injectable()
/** The candidates: taking an application with its consent, moving them through the pipeline, notes, deletion with every trace, and the step to the shifts. */
export class HiringCandidatesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly office: OfficeLog,
        private readonly storage: CvStorage,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly settings: HiringSettingsService,
        private readonly screening: HiringScreeningService,
    ) {}

    /** One candidate of the workspace; throws when there is none. */
    async requireCandidate(workspaceId: string, candidateId: string): Promise<CandidateRecord> {
        const candidate = await this.data.candidate(workspaceId, candidateId)
        if (candidate === undefined) throw new HiringError({ code: HiringErrorCode.CandidateNotFound })
        return candidate
    }

    /** One candidate who is still in the pipeline; throws when there is none or when the candidate is rejected, withdrawn or hired. */
    async requireOpenCandidate(workspaceId: string, candidateId: string): Promise<CandidateRecord> {
        const candidate = await this.requireCandidate(workspaceId, candidateId)
        if (CLOSED_STAGES.has(candidate.stage)) {
            throw new HiringError({
                code: HiringErrorCode.CandidateClosed,
                params: { stage: this.words.text(`hiring.stage.${candidate.stage}`) },
            })
        }
        return candidate
    }

    /**
     * Stores one application: the job must be open, the contact details and the required answers right, and the applicant must have agreed.
     * The same phone applying twice for a job is one application. A new application is announced in the Office and queued for screening.
     */
    async submit(
        workspaceId: string,
        job: JobRecord,
        source: ApplicationSource,
        input: ApplicationInput,
        extras: ApplicationExtras = {},
    ): Promise<SubmittedApplication> {
        const closed = openingRefusal(job, this.clock.now())
        if (closed !== null) throw new HiringError(closed)
        const checked = checkApplication(job, input)
        if (!checked.ok) throw new HiringError(checked.refusal)
        const settings = await this.settings.ensure(workspaceId)
        const clean = checked.value
        const [row] = await this.entityManager.query<Array<SubmitRow>>(SUBMIT_APPLICATION, [
            workspaceId,
            job.id,
            JSON.stringify({
                name: clean.name,
                phone: clean.phone,
                email: clean.email,
                source,
                conversationId: extras.conversationId ?? null,
                cvPath: extras.cv?.path ?? null,
                cvName: extras.cv?.name ?? null,
                cvMime: extras.cv?.mime ?? null,
                cvSize: extras.cv?.size ?? null,
                answers: clean.answers.map((answer) => ({
                    question_id: answer.questionId,
                    question: answer.question,
                    answer: answer.answer,
                })),
                availability: clean.availability,
            }),
            settings.applyConsentText,
            extras.ipHash ?? null,
            [this.words.text(`hiring.applied.${source}`), this.words.text("hiring.applied.consent")],
        ])
        if (row === undefined) throw new HiringError({ code: HiringErrorCode.JobNotOpen })
        if (!row.duplicate) {
            if (settings.notifyNewCandidate) {
                await this.office.postOffice(
                    workspaceId,
                    this.words.text("hiring.office.newCandidate", {
                        title: job.title,
                        name: clean.name,
                        cv: extras.cv === undefined ? "" : this.words.text("hiring.office.withCv"),
                    }),
                )
            }
            await this.screening.requestScreening(workspaceId, row.id, false)
        }
        return { candidateId: row.id, duplicate: row.duplicate }
    }

    /** Moves a candidate to another stage. Hired comes from accepting the offer, the offer column from writing the offer, and a rejection carries a fair reason. */
    async move(userId: string, workspaceId: string, request: MoveCandidateParams): Promise<MoveCandidateOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if (!isStage(request.stage)) throw new HiringError({ code: HiringErrorCode.StageInvalid })
        const current = await this.requireCandidate(workspaceId, request.id)
        if (current.stage === request.stage) return { stage: current.stage }
        if (request.stage === "hired") throw new HiringError({ code: HiringErrorCode.StageHiredByOffer })
        if (request.stage === "offer" && !(await this.data.hasActiveOffer(current.id))) {
            throw new HiringError({ code: HiringErrorCode.StageOfferByOffer })
        }
        const reason = (request.reason ?? "").trim()
        if (request.stage === "rejected") this.checkReason(reason)
        const summary = this.words.text(request.stage === "rejected" ? "hiring.event.rejected" : "hiring.event.stage", {
            stage: this.words.text(`hiring.stage.${request.stage}`),
            reason: reason.slice(0, REASON_MAX),
        })
        await this.entityManager.query<Array<FlagRow>>(MOVE_CANDIDATE, [
            workspaceId,
            current.id,
            request.stage,
            reason,
            displayName,
            summary,
        ])
        return { stage: request.stage }
    }

    private checkReason(reason: string): void {
        if (reason.length < REASON_MIN) throw new HiringError({ code: HiringErrorCode.RejectReasonRequired })
        const found = findFairnessViolations(reason)[0]
        if (found !== undefined) {
            throw new HiringError({
                code: HiringErrorCode.Unfair,
                params: {
                    detail: this.words.text("hiring.fairness.reason", {
                        trait: this.words.text(`hiring.fairness.${found.category}`),
                        advice: this.words.text("hiring.fairness.advice"),
                    }),
                },
            })
        }
    }

    /** Saves the notes of a candidate; notes about a protected trait are refused. */
    async saveNotes(userId: string, workspaceId: string, request: SaveNotesParams): Promise<void> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const found = findFairnessViolations(request.notes)[0]
        if (found !== undefined) {
            throw new HiringError({
                code: HiringErrorCode.Unfair,
                params: {
                    detail: this.words.text("hiring.fairness.notes", {
                        trait: this.words.text(`hiring.fairness.${found.category}`),
                    }),
                },
            })
        }
        const [row] = await this.entityManager.query<Array<FlagRow>>(SAVE_NOTES, [
            workspaceId,
            request.id,
            request.notes.slice(0, NOTES_MAX),
            displayName,
            this.words.text("hiring.event.notes"),
        ])
        if (row?.value !== true) throw new HiringError({ code: HiringErrorCode.CandidateNotFound })
    }

    /** Deletes candidates with every trace: the answers, the consent, the interviews, the offers and the CV files. */
    async deleteAll(workspaceId: string, candidateIds: ReadonlyArray<string>): Promise<DeletedCandidates> {
        if (candidateIds.length === 0) return { candidates: 0, files: 0 }
        const [row] = await this.entityManager.query<Array<PathsRow>>(DELETE_CANDIDATES, [
            workspaceId,
            [...candidateIds],
        ])
        const paths = row?.paths ?? []
        const files = paths.length === 0 ? 0 : await this.storage.remove(paths)
        return { candidates: candidateIds.length, files }
    }

    /** Deletes one candidate with every trace (the owner answering a request of the candidate). */
    async delete(userId: string, workspaceId: string, request: DeleteCandidateParams): Promise<DeleteCandidateOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.requireCandidate(workspaceId, request.id)
        const removed = await this.deleteAll(workspaceId, [candidate.id])
        return { files: removed.files }
    }

    /** A short-lived link to look at the CV of a candidate; empty when there is none. */
    async cv(userId: string, workspaceId: string, request: CandidateCvParams): Promise<CandidateCvOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.requireCandidate(workspaceId, request.id)
        const url = candidate.cvPath === null ? null : await this.storage.signedUrl(candidate.cvPath)
        return url === null
            ? { url: null, name: null, mime: null }
            : { url, name: candidate.cvName ?? "cv", mime: candidate.cvMime ?? "application/pdf" }
    }

    /** Makes a hired candidate a person in the shifts. */
    async linkStaff(userId: string, workspaceId: string, request: LinkStaffParams): Promise<LinkStaffOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.requireCandidate(workspaceId, request.candidateId)
        if (candidate.stage !== "hired") throw new HiringError({ code: HiringErrorCode.StaffNotHired })
        if (candidate.staffId !== null) throw new HiringError({ code: HiringErrorCode.StaffLinked })
        const [row] = await this.entityManager.query<Array<StaffLinkRow>>(LINK_STAFF, [workspaceId, candidate.id])
        if (row?.staff_id === null || row?.staff_id === undefined)
            throw new HiringError({ code: HiringErrorCode.StaffLinked })
        await this.office.logEvidence(workspaceId, {
            kind: "hiring.staff_linked",
            actor: displayName,
            summary: this.words.text("hiring.event.staffLinked", { name: candidate.name }),
        })
        return { staffId: row.staff_id }
    }

    /** Ticks or unticks a step of the onboarding checklist. */
    async toggleOnboarding(userId: string, workspaceId: string, request: ToggleOnboardingParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const [row] = await this.entityManager.query<Array<FlagRow>>(TOGGLE_ONBOARDING, [
            workspaceId,
            request.id,
            request.done,
        ])
        if (row?.value !== true) throw new HiringError({ code: HiringErrorCode.OnboardingNotFound })
    }

    /** Closes a job once enough people accepted, when the workspace asked for it; answers whether it closed. */
    async closeJobIfFilled(workspaceId: string, jobId: string): Promise<boolean> {
        const [row] = await this.entityManager.query<Array<FilledRow>>(FILL_CHECK, [workspaceId, jobId])
        if (!row?.closed) return false
        await this.office.postOffice(
            workspaceId,
            this.words.text("hiring.office.jobFilled", {
                title: row.title,
                hired: Number(row.hired),
                headcount: row.headcount,
            }),
        )
        return true
    }
}
