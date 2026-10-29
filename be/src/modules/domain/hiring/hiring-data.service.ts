import { randomBytes } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { Between, In, IsNull, LessThan, Like } from "typeorm"
import type { EntityManager } from "typeorm"
import { AgentConversationEntity } from "@modules/domain/agent-conversations"
import { WorkItemEntity } from "@modules/domain/work-items"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { WorkspaceEntity } from "@modules/domain/workspaces"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    AvailabilityWindow,
    CandidateRecord,
    HiringSettings,
    InterviewRecord,
    JobRecord,
    OfferRecord,
    Slot,
} from "./hiring.contracts"
import {
    HiringAvailabilityEntity,
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringJobEntity,
    HiringOfferEntity,
    HiringSettingEntity,
} from "./persistence/entities"
import { toCandidate, toInterview, toJob, toOffer, toSettings } from "./policies/row-mappers.policy"
import { hiringIsoOf } from "./policies/vn-time.policy"

/** How many chat jobs the chat offers an applicant. */
const CHAT_JOBS_LIMIT = 5
/** How many live jobs one sweep looks at. */
const LIVE_JOBS_LIMIT = 500
/** How many candidates one retention run deletes. */
const RETENTION_LIMIT = 200
/** How many reminders one run sends. */
const REMINDERS_LIMIT = 200
/** How many busy interviews of one interviewer are read. */
const BUSY_LIMIT = 500
/** How many weekly windows of one member are read. */
const AVAILABILITY_LIMIT = 50
/** How many interviewers are offered. */
const INTERVIEWERS_LIMIT = 20

/** Who can interview: an active member and whether they own the workspace. */
export interface Interviewer {
    /** The account. */
    readonly userId: string
    /** The name shown. */
    readonly name: string
    /** Whether the member owns the workspace. */
    readonly isOwner: boolean
}

/** One member row of the interviewer query as the database answers it. */
interface InterviewerRaw {
    /** The account. */
    readonly user_id: string
    /** The display name. */
    readonly display_name: string
    /** Whether the member owns the workspace. */
    readonly is_owner: boolean
}

@Injectable()
/** Reads what the hiring flows run against: settings, jobs, candidates, interviews, offers and the members who interview. */
export class HiringDataService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The settings of a workspace, or undefined before they are created. */
    async settings(workspaceId: string): Promise<HiringSettings | undefined> {
        const row = await this.entityManager.findOne(HiringSettingEntity, { where: { workspaceId } })
        return row === null ? undefined : toSettings(row)
    }

    /** The settings behind a public slug, or undefined. */
    async settingsBySlug(slug: string): Promise<HiringSettings | undefined> {
        const row = await this.entityManager.findOne(HiringSettingEntity, { where: { publicSlug: slug } })
        return row === null ? undefined : toSettings(row)
    }

    /** The name of a candidate and the title and place of the job, for the public pages; undefined when either is gone. */
    async heads(
        candidateId: string,
        jobId: string,
    ): Promise<{ candidateName: string; jobTitle: string; jobLocation: string } | undefined> {
        const [candidate, job] = await Promise.all([this.candidateHead(candidateId), this.jobHead(jobId)])
        return candidate === undefined || job === undefined
            ? undefined
            : { candidateName: candidate.name, jobTitle: job.title, jobLocation: job.location }
    }

    /** The retention and reminder choices of a workspace for the tick, or undefined when it does not use hiring. */
    async tickWorkspace(
        workspaceId: string,
    ): Promise<{ workspaceId: string; retentionDays: number; remindInterview: boolean } | undefined> {
        const row = await this.entityManager.findOne(HiringSettingEntity, {
            select: { workspaceId: true, retentionDays: true, remindInterview: true },
            where: { workspaceId },
        })
        return row === null
            ? undefined
            : { workspaceId: row.workspaceId, retentionDays: row.retentionDays, remindInterview: row.remindInterview }
    }

    /** One job, or undefined. */
    async job(workspaceId: string, jobId: string): Promise<JobRecord | undefined> {
        const row = await this.entityManager.findOne(HiringJobEntity, { where: { workspaceId, id: jobId } })
        return row === null ? undefined : toJob(row)
    }

    /** One job by its slug, or undefined. */
    async jobBySlug(workspaceId: string, slug: string): Promise<JobRecord | undefined> {
        const row = await this.entityManager.findOne(HiringJobEntity, { where: { workspaceId, slug } })
        return row === null ? undefined : toJob(row)
    }

    /** The open jobs the chat takes applications for. */
    async chatJobs(workspaceId: string): Promise<Array<JobRecord>> {
        const rows = await this.entityManager
            .createQueryBuilder(HiringJobEntity, "job")
            .where("job.workspaceId = :workspaceId", { workspaceId })
            .andWhere("job.status = :status", { status: "open" })
            .andWhere(":channel = ANY(job.channels)", { channel: "chat" })
            .orderBy("job.createdAt", "ASC")
            .take(CHAT_JOBS_LIMIT)
            .getMany()
        return rows.map(toJob)
    }

    /** The ids of the open and paused jobs. */
    async liveJobIds(workspaceId: string): Promise<Array<string>> {
        const rows = await this.entityManager.find(HiringJobEntity, {
            select: { id: true },
            where: { workspaceId, status: In(["open", "paused"]) },
            take: LIVE_JOBS_LIMIT,
        })
        return rows.map((row) => row.id)
    }

    /** One candidate, or undefined. */
    async candidate(workspaceId: string, candidateId: string): Promise<CandidateRecord | undefined> {
        const row = await this.entityManager.findOne(HiringCandidateEntity, {
            where: { workspaceId, id: candidateId },
        })
        return row === null ? undefined : toCandidate(row)
    }

    /** The id and name of a candidate, or undefined. */
    async candidateHead(candidateId: string): Promise<{ id: string; name: string } | undefined> {
        const row = await this.entityManager.findOne(HiringCandidateEntity, {
            select: { id: true, name: true },
            where: { id: candidateId },
        })
        return row === null ? undefined : { id: row.id, name: row.name }
    }

    /** The title, place and position of a job, or undefined. */
    async jobHead(jobId: string): Promise<{ title: string; location: string; position: string } | undefined> {
        const row = await this.entityManager.findOne(HiringJobEntity, {
            select: { title: true, location: true, position: true },
            where: { id: jobId },
        })
        return row === null ? undefined : { title: row.title, location: row.location, position: row.position }
    }

    /** The candidates whose retention period has run out. */
    async retentionDue(workspaceId: string, cutoff: Date): Promise<Array<string>> {
        const rows = await this.entityManager.find(HiringCandidateEntity, {
            select: { id: true },
            where: { workspaceId, stage: In(["rejected", "withdrawn"]), stageChangedAt: LessThan(cutoff) },
            order: { stageChangedAt: "ASC" },
            take: RETENTION_LIMIT,
        })
        return rows.map((row) => row.id)
    }

    /** Whether a candidate has an interview that is proposed or confirmed. */
    hasOpenInterview(candidateId: string): Promise<boolean> {
        return this.entityManager.exists(HiringInterviewEntity, {
            where: { candidateId, status: In(["proposed", "confirmed"]) },
        })
    }

    /** The interview behind a link token, or undefined. */
    async interviewByToken(token: string): Promise<InterviewRecord | undefined> {
        const row = await this.entityManager.findOne(HiringInterviewEntity, { where: { token } })
        return row === null ? undefined : toInterview(row)
    }

    /** The confirmed interviews that start between two moments and were not reminded. */
    async dueReminders(workspaceId: string, from: Date, until: Date): Promise<Array<InterviewRecord>> {
        const rows = await this.entityManager.find(HiringInterviewEntity, {
            where: { workspaceId, status: "confirmed", reminderSentAt: IsNull(), slotStart: Between(from, until) },
            order: { slotStart: "ASC" },
            take: REMINDERS_LIMIT,
        })
        return rows.map(toInterview)
    }

    /** The times an interviewer is taken: confirmed times and the times offered to candidates. */
    async busy(workspaceId: string, userId: string): Promise<Array<Slot>> {
        const rows = await this.entityManager.find(HiringInterviewEntity, {
            select: { slotStart: true, slotEnd: true, proposedSlots: true, status: true },
            where: { workspaceId, interviewerUserId: userId, status: In(["proposed", "confirmed"]) },
            take: BUSY_LIMIT,
        })
        return rows.flatMap((row): Array<Slot> => {
            if (row.status === "confirmed" && row.slotStart !== null && row.slotEnd !== null) {
                return [{ start: hiringIsoOf(row.slotStart), end: hiringIsoOf(row.slotEnd) }]
            }
            return (row.proposedSlots ?? []).map((slot) => ({ start: slot.start, end: slot.end }))
        })
    }

    /** The weekly windows a member declared. */
    async availability(workspaceId: string, userId: string): Promise<Array<AvailabilityWindow>> {
        const rows = await this.entityManager.find(HiringAvailabilityEntity, {
            select: { weekday: true, startMin: true, endMin: true },
            where: { workspaceId, memberUserId: userId },
            take: AVAILABILITY_LIMIT,
        })
        return rows.map((row) => ({ weekday: row.weekday, startMin: row.startMin, endMin: row.endMin }))
    }

    /** The name of an active member, or undefined when the account is not one. */
    async memberName(
        workspaceId: string,
        userId: string,
    ): Promise<{ userId: string; displayName: string } | undefined> {
        const row = await this.entityManager.findOne(WorkspaceMemberEntity, {
            select: { userId: true, displayName: true },
            where: { workspaceId, userId, status: "active" },
        })
        return row === null ? undefined : { userId: row.userId, displayName: row.displayName }
    }

    /** The active members, the owner first. */
    async interviewers(workspaceId: string): Promise<Array<Interviewer>> {
        const rows = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "member")
            .innerJoin(WorkspaceEntity, "workspace", "workspace.id = member.workspaceId")
            .select("member.userId", "user_id")
            .addSelect("member.displayName", "display_name")
            .addSelect("member.userId = workspace.ownerId", "is_owner")
            .where("member.workspaceId = :workspaceId", { workspaceId })
            .andWhere("member.status = :status", { status: "active" })
            .orderBy("is_owner", "DESC")
            .addOrderBy("member.createdAt", "ASC")
            .limit(INTERVIEWERS_LIMIT)
            .getRawMany<InterviewerRaw>()
        return rows.map((row) => ({ userId: row.user_id, name: row.display_name, isOwner: row.is_owner }))
    }

    /** One offer, or undefined. */
    async offer(workspaceId: string, offerId: string): Promise<OfferRecord | undefined> {
        const row = await this.entityManager.findOne(HiringOfferEntity, { where: { workspaceId, id: offerId } })
        return row === null ? undefined : toOffer(row)
    }

    /** The offer behind a link token, or undefined. */
    async offerByToken(token: string): Promise<OfferRecord | undefined> {
        const row = await this.entityManager.findOne(HiringOfferEntity, { where: { token } })
        return row === null ? undefined : toOffer(row)
    }

    /** Whether a candidate has an offer that is a draft, waiting or sent. */
    hasActiveOffer(candidateId: string): Promise<boolean> {
        return this.entityManager.exists(HiringOfferEntity, {
            where: { candidateId, status: In(["draft", "waiting", "sent"]) },
        })
    }

    /** The channel of a chat conversation, or null. */
    async conversationChannel(conversationId: string): Promise<string | null> {
        const row = await this.entityManager.findOne(AgentConversationEntity, {
            select: { channel: true },
            where: { id: conversationId },
        })
        return row?.channel ?? null
    }

    /** A fresh 128-bit random token for a link or upload folder, retaining the legacy 32-hex format. */
    newToken(): Promise<string> {
        return Promise.resolve(randomBytes(16).toString("hex"))
    }

    /** How many times an action was asked with one dedupe prefix, so a repeated ask gets a fresh key. */
    askAttempts(workspaceId: string, action: string, prefix: string): Promise<number> {
        return this.entityManager.count(WorkItemEntity, {
            where: { workspaceId, action, dedupeKey: Like(`${prefix}%`) },
        })
    }
}
