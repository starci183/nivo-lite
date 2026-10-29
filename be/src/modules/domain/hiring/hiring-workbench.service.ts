import { Injectable } from "@nestjs/common"
import { And, In, LessThan, MoreThanOrEqual } from "typeorm"
import type { EntityManager } from "typeorm"
import { WorkItemEntity } from "@modules/domain/work-items"
import { WorkspaceMemberEntity, WorkspaceMembersService } from "@modules/domain/workspace-members"
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
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringEventEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringOnboardingEntity,
} from "./persistence/entities"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { toCandidate, toInterview, toJob, toOffer } from "./policies/row-mappers.policy"
import { addDays, hiringIsoOf, isoOrNull, vnInstant, vnClockParts } from "./policies/vn-time.policy"

/** How many jobs the workbench shows. */
const JOBS_LIMIT = 500
/** How many candidates the workbench shows. */
const CANDIDATES_LIMIT = 1000
/** How many interviews the workbench shows. */
const INTERVIEWS_LIMIT = 300
/** How many offers the workbench shows. */
const OFFERS_LIMIT = 300
/** How many onboarding steps the workbench shows. */
const ONBOARDING_LIMIT = 2000
/** How many members the workbench shows. */
const MEMBERS_LIMIT = 500
/** How many availability windows the workbench shows. */
const WINDOWS_LIMIT = 2000
/** How many events the candidate drawer shows. */
const EVENTS_LIMIT = 60
/** The stages that still move through the pipeline. */
const PIPELINE_STAGES = ["applied", "screening", "shortlisted", "interview", "offer"] as const

const iso = isoOrNull
const isoS = (value: Date | string): string => hiringIsoOf(value)

/** A week range. */
interface WeekBounds {
    /** The Monday the week starts. */
    readonly from: Date
    /** The Monday after the week. */
    readonly to: Date
}

/** The Monday-to-Monday bounds of the current week on the Vietnam calendar. */
const weekBounds = (now: Date): WeekBounds => {
    const parts = vnClockParts(now)
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
                this.entityManager.find(HiringJobEntity, {
                    where: { workspaceId },
                    order: { createdAt: "DESC" },
                    take: JOBS_LIMIT,
                }),
                this.entityManager.find(HiringCandidateEntity, {
                    where: { workspaceId },
                    order: { createdAt: "DESC" },
                    take: CANDIDATES_LIMIT,
                }),
                this.entityManager.find(HiringInterviewEntity, {
                    where: { workspaceId },
                    order: { createdAt: "DESC" },
                    take: INTERVIEWS_LIMIT,
                }),
                this.entityManager.find(HiringOfferEntity, {
                    where: { workspaceId },
                    order: { createdAt: "DESC" },
                    take: OFFERS_LIMIT,
                }),
                this.entityManager.find(HiringOnboardingEntity, {
                    where: { workspaceId },
                    order: { sort: "ASC" },
                    take: ONBOARDING_LIMIT,
                }),
                this.entityManager.find(WorkspaceMemberEntity, {
                    where: { workspaceId, status: "active" },
                    order: { createdAt: "ASC" },
                    take: MEMBERS_LIMIT,
                }),
                this.entityManager.find(HiringAvailabilityEntity, { where: { workspaceId }, take: WINDOWS_LIMIT }),
                this.entityManager.count(WorkItemEntity, {
                    where: { workspaceId, department: "hiring", status: "waiting_decision" },
                }),
                this.figures(workspaceId),
            ])
        const windowsByMember = new Map<string, Array<{ weekday: number; startMin: number; endMin: number }>>()
        for (const row of availability) {
            const list = windowsByMember.get(row.memberUserId) ?? []
            list.push({ weekday: row.weekday, startMin: row.startMin, endMin: row.endMin })
            windowsByMember.set(row.memberUserId, list)
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
                candidateId: row.candidateId,
                title: row.title,
                done: row.done,
                doneAt: iso(row.doneAt),
                sort: row.sort,
            })),
            members: memberRows.map((row) => ({
                userId: row.userId,
                name: row.displayName,
                role: row.role,
                windows: windowsByMember.get(row.userId) ?? [],
            })),
            waitingApprovals: waiting,
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
            this.entityManager.find(HiringEventEntity, {
                where: { workspaceId, candidateId: candidate.id },
                order: { createdAt: "DESC" },
                take: EVENTS_LIMIT,
            }),
            this.candidates.cv(userId, workspaceId, { id: candidate.id }),
        ])
        return {
            events: events.map((row): HiringEventView => ({
                id: row.id,
                kind: row.kind,
                actor: row.actor,
                summary: row.summary,
                createdAt: isoS(row.createdAt),
            })),
            cv: cv.url === null ? null : { url: cv.url, name: cv.name ?? "cv", mime: cv.mime ?? "application/pdf" },
        }
    }

    private async figures(workspaceId: string): Promise<HiringFiguresView> {
        const week = weekBounds(this.clock.now())
        const [openRoles, totalRoles, pipeline, interviewsWeek, offersWaiting, offersSent] = await Promise.all([
            this.entityManager.count(HiringJobEntity, { where: { workspaceId, status: "open" } }),
            this.entityManager.count(HiringJobEntity, { where: { workspaceId } }),
            this.entityManager.count(HiringCandidateEntity, { where: { workspaceId, stage: In(PIPELINE_STAGES) } }),
            this.entityManager.count(HiringInterviewEntity, {
                where: {
                    workspaceId,
                    status: "confirmed",
                    slotStart: And(MoreThanOrEqual(week.from), LessThan(week.to)),
                },
            }),
            this.entityManager.count(HiringOfferEntity, { where: { workspaceId, status: "waiting" } }),
            this.entityManager.count(HiringOfferEntity, { where: { workspaceId, status: "sent" } }),
        ])
        return { openRoles, totalRoles, pipeline, interviewsWeek, offersWaiting, offersSent }
    }

    private jobView(row: HiringJobEntity, publicSlug: string): HiringJobView {
        return {
            ...toJob(row),
            adVariants: row.adVariants,
            createdAt: isoS(row.createdAt),
            updatedAt: isoS(row.updatedAt),
            publicUrl: this.links.job(publicSlug, row.slug),
        }
    }

    private candidateView(row: HiringCandidateEntity): HiringCandidateView {
        return {
            ...toCandidate(row),
            cvSize: row.cvSize,
            score: row.score,
            scoreLabel: row.scoreLabel,
            scoreReasons: row.scoreReasons ?? [],
            scoreSummary: row.scoreSummary,
            screenedAt: iso(row.screenedAt),
            stageChangedAt: isoS(row.stageChangedAt),
            rejectedReason: row.rejectedReason,
            notes: row.notes,
            createdAt: isoS(row.createdAt),
        }
    }

    private interviewView(row: HiringInterviewEntity): HiringInterviewView {
        return {
            ...toInterview(row),
            reminderSentAt: iso(row.reminderSentAt),
            createdAt: isoS(row.createdAt),
        }
    }

    private offerView(row: HiringOfferEntity): HiringOfferView {
        return {
            ...toOffer(row),
            sentVia: row.sentVia,
            sentAt: iso(row.sentAt),
            respondedAt: iso(row.respondedAt),
            createdAt: isoS(row.createdAt),
        }
    }
}
