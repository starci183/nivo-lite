import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import type {
    HiringBenchView,
    HiringCandidateDetailView,
    HiringCandidateView,
    HiringEventView,
    HiringFiguresView,
    HiringInterviewView,
    HiringJobView,
    HiringOfferView,
} from "./hiring-workbench.contracts"
import {
    COUNT_WAITING_APPROVALS,
    SELECT_ALL_AVAILABILITY,
    SELECT_CANDIDATE_EVENTS,
    SELECT_FIGURES,
    SELECT_WORKBENCH_CANDIDATES,
    SELECT_WORKBENCH_INTERVIEWS,
    SELECT_WORKBENCH_JOBS,
    SELECT_WORKBENCH_MEMBERS,
    SELECT_WORKBENCH_OFFERS,
    SELECT_WORKBENCH_ONBOARDING,
} from "./persistence/hiring-workbench.sql"
import type {
    CountRow,
    HiringEventRow,
    HiringFiguresRow,
    WorkbenchAvailabilityRow,
    WorkbenchCandidateRow,
    WorkbenchInterviewRow,
    WorkbenchJobRow,
    WorkbenchMemberRow,
    WorkbenchOfferRow,
    WorkbenchOnboardingRow,
} from "./persistence/hiring-workbench.rows"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { toCandidate, toInterview, toJob, toOffer } from "./policies/row-mappers.policy"
import { addDays, isoOf, isoOrNull, vnInstant, vnParts } from "./policies/vn-time.policy"

const iso = isoOrNull
const isoS = (value: Date | string): string => isoOf(value)

/** A week range. */
interface WeekBounds {
    /** The Monday the week starts. */
    readonly from: Date
    /** The Monday after the week. */
    readonly to: Date
}

/** The Monday-to-Monday bounds of the current week on the Vietnam calendar. */
const weekBounds = (now: Date): WeekBounds => {
    const parts = vnParts(now)
    const back = (parts.weekday + 6) % 7
    const from = vnInstant(parts.year, parts.month, parts.day - back, 0)
    return { from, to: addDays(from, 7) }
}

@Injectable()
/** The read model of the hiring workbench: jobs with their public links, the pipeline, interviews, offers, onboarding, members and figures — and one candidate's timeline. */
export class HiringWorkbenchService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly settings: HiringSettingsService,
        private readonly links: HiringLinksService,
        private readonly candidates: HiringCandidatesService,
    ) {}

    /** The whole workbench; only an owner or a manager may read it. */
    async bench(userId: string, workspaceId: string): Promise<HiringBenchView> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const settings = await this.settings.ensure(workspaceId)
        const [jobs, candidates, interviews, offers, onboarding, memberRows, availability, waiting, figures] =
            await Promise.all([
                this.entityManager.query<Array<WorkbenchJobRow>>(SELECT_WORKBENCH_JOBS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchCandidateRow>>(SELECT_WORKBENCH_CANDIDATES, [workspaceId]),
                this.entityManager.query<Array<WorkbenchInterviewRow>>(SELECT_WORKBENCH_INTERVIEWS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchOfferRow>>(SELECT_WORKBENCH_OFFERS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchOnboardingRow>>(SELECT_WORKBENCH_ONBOARDING, [workspaceId]),
                this.entityManager.query<Array<WorkbenchMemberRow>>(SELECT_WORKBENCH_MEMBERS, [workspaceId]),
                this.entityManager.query<Array<WorkbenchAvailabilityRow>>(SELECT_ALL_AVAILABILITY, [workspaceId]),
                this.entityManager.query<Array<CountRow>>(COUNT_WAITING_APPROVALS, [workspaceId]),
                this.figures(workspaceId),
            ])
        const windowsByMember = new Map<string, Array<{ weekday: number; startMin: number; endMin: number }>>()
        for (const row of availability) {
            const list = windowsByMember.get(row.member_user_id) ?? []
            list.push({ weekday: row.weekday, startMin: row.start_min, endMin: row.end_min })
            windowsByMember.set(row.member_user_id, list)
        }
        return {
            nowIso: this.clock.now().toISOString(),
            origin: this.links.siteOrigin(),
            settings,
            jobs: jobs.map((row) => this.jobView(row, settings.publicSlug)),
            candidates: candidates.map((row) => this.candidateView(row)),
            interviews: interviews.map((row) => this.interviewView(row)),
            offers: offers.map((row) => this.offerView(row)),
            onboarding: onboarding.map((row) => ({
                id: row.id,
                candidateId: row.candidate_id,
                title: row.title,
                done: row.done,
                doneAt: iso(row.done_at),
                sort: row.sort,
            })),
            members: memberRows.map((row) => ({
                userId: row.user_id,
                name: row.display_name,
                role: row.role,
                windows: windowsByMember.get(row.user_id) ?? [],
            })),
            waitingApprovals: Number(waiting[0]?.n ?? 0),
            figures,
            meUserId: userId,
        }
    }

    /** The candidate drawer's timeline and CV link. */
    async candidateDetail(
        userId: string,
        workspaceId: string,
        candidateId: string,
    ): Promise<HiringCandidateDetailView> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.candidates.requireCandidate(workspaceId, candidateId)
        const [events, cv] = await Promise.all([
            this.entityManager.query<Array<HiringEventRow>>(SELECT_CANDIDATE_EVENTS, [workspaceId, candidate.id]),
            this.candidates.cv(userId, workspaceId, { id: candidate.id }),
        ])
        return {
            events: events.map((row): HiringEventView => ({
                id: row.id,
                kind: row.kind,
                actor: row.actor,
                summary: row.summary,
                createdAt: isoS(row.created_at),
            })),
            cv: cv.url === null ? null : { url: cv.url, name: cv.name ?? "cv", mime: cv.mime ?? "application/pdf" },
        }
    }

    private async figures(workspaceId: string): Promise<HiringFiguresView> {
        const week = weekBounds(this.clock.now())
        const [row] = await this.entityManager.query<Array<HiringFiguresRow>>(SELECT_FIGURES, [
            workspaceId,
            week.from.toISOString(),
            week.to.toISOString(),
        ])
        return {
            openRoles: Number(row?.open_roles ?? 0),
            totalRoles: Number(row?.total_roles ?? 0),
            pipeline: Number(row?.pipeline ?? 0),
            interviewsWeek: Number(row?.interviews_week ?? 0),
            offersWaiting: Number(row?.offers_waiting ?? 0),
            offersSent: Number(row?.offers_sent ?? 0),
        }
    }

    private jobView(row: WorkbenchJobRow, publicSlug: string): HiringJobView {
        return {
            ...toJob(row),
            adVariants: row.ad_variants,
            createdAt: isoS(row.created_at),
            updatedAt: isoS(row.updated_at),
            publicUrl: this.links.job(publicSlug, row.slug),
        }
    }

    private candidateView(row: WorkbenchCandidateRow): HiringCandidateView {
        return {
            ...toCandidate(row),
            cvSize: row.cv_size,
            score: row.score,
            scoreLabel: row.score_label,
            scoreReasons: row.score_reasons ?? [],
            scoreSummary: row.score_summary,
            screenedAt: iso(row.screened_at),
            stageChangedAt: isoS(row.stage_changed_at),
            rejectedReason: row.rejected_reason,
            notes: row.notes,
            createdAt: isoS(row.created_at),
        }
    }

    private interviewView(row: WorkbenchInterviewRow): HiringInterviewView {
        return {
            ...toInterview(row),
            reminderSentAt: iso(row.reminder_sent_at),
            createdAt: isoS(row.created_at),
        }
    }

    private offerView(row: WorkbenchOfferRow): HiringOfferView {
        return {
            ...toOffer(row),
            sentVia: row.sent_via,
            sentAt: iso(row.sent_at),
            respondedAt: iso(row.responded_at),
            createdAt: isoS(row.created_at),
        }
    }
}
