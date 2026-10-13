import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
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
    COUNT_ASKS,
    NEW_TOKEN,
    SELECT_ACTIVE_OFFER,
    SELECT_AVAILABILITY,
    SELECT_BUSY,
    SELECT_CANDIDATE,
    SELECT_CANDIDATE_HEAD,
    SELECT_CHAT_JOBS,
    SELECT_CONVERSATION_CHANNEL,
    SELECT_DUE_REMINDERS,
    SELECT_INTERVIEW_BY_TOKEN,
    SELECT_INTERVIEWERS,
    SELECT_JOB,
    SELECT_JOB_BY_SLUG,
    SELECT_JOB_HEAD,
    SELECT_LIVE_JOBS,
    SELECT_MEMBER_NAME,
    SELECT_OFFER,
    SELECT_OFFER_BY_TOKEN,
    SELECT_OPEN_INTERVIEW,
    SELECT_RETENTION_DUE,
    SELECT_SETTINGS,
    SELECT_SETTINGS_BY_SLUG,
    SELECT_TICK_WORKSPACE,
} from "./persistence/hiring.sql"
import type {
    AvailabilityRow,
    BusyRow,
    CandidateHeadRow,
    ChannelRow,
    HiringCandidatesRow,
    HiringInterviewsRow,
    HiringJobsRow,
    HiringOffersRow,
    HiringSettingsRow,
    IdRow,
    InterviewerRow,
    JobHeadRow,
    MemberNameRow,
    TickWorkspaceRow,
    CountRow,
    TextRow,
} from "./persistence/hiring.rows"
import { toCandidate, toInterview, toJob, toOffer, toSettings } from "./policies/row-mappers.policy"
import { isoOf } from "./policies/vn-time.policy"

/** Who can interview: an active member and whether they own the workspace. */
export interface Interviewer {
    /** The account. */
    readonly userId: string
    /** The name shown. */
    readonly name: string
    /** Whether the member owns the workspace. */
    readonly isOwner: boolean
}

@Injectable()
/** Reads what the hiring flows run against: settings, jobs, candidates, interviews, offers and the members who interview. */
export class HiringDataService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    private async first<Row>(rows: Promise<Array<Row>>): Promise<Row | undefined> {
        const [row] = await rows
        return row
    }

    /** The settings of a workspace, or undefined before they are created. */
    async settings(workspaceId: string): Promise<HiringSettings | undefined> {
        const row = await this.first(this.entityManager.query<Array<HiringSettingsRow>>(SELECT_SETTINGS, [workspaceId]))
        return row === undefined ? undefined : toSettings(row)
    }

    /** The settings behind a public slug, or undefined. */
    async settingsBySlug(slug: string): Promise<HiringSettings | undefined> {
        const row = await this.first(
            this.entityManager.query<Array<HiringSettingsRow>>(SELECT_SETTINGS_BY_SLUG, [slug]),
        )
        return row === undefined ? undefined : toSettings(row)
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
    tickWorkspace(workspaceId: string): Promise<TickWorkspaceRow | undefined> {
        return this.first(this.entityManager.query<Array<TickWorkspaceRow>>(SELECT_TICK_WORKSPACE, [workspaceId]))
    }

    /** One job, or undefined. */
    async job(workspaceId: string, jobId: string): Promise<JobRecord | undefined> {
        const row = await this.first(this.entityManager.query<Array<HiringJobsRow>>(SELECT_JOB, [workspaceId, jobId]))
        return row === undefined ? undefined : toJob(row)
    }

    /** One job by its slug, or undefined. */
    async jobBySlug(workspaceId: string, slug: string): Promise<JobRecord | undefined> {
        const row = await this.first(
            this.entityManager.query<Array<HiringJobsRow>>(SELECT_JOB_BY_SLUG, [workspaceId, slug]),
        )
        return row === undefined ? undefined : toJob(row)
    }

    /** The open jobs the chat takes applications for. */
    async chatJobs(workspaceId: string): Promise<Array<JobRecord>> {
        const rows = await this.entityManager.query<Array<HiringJobsRow>>(SELECT_CHAT_JOBS, [workspaceId])
        return rows.map(toJob)
    }

    /** The ids of the open and paused jobs. */
    async liveJobIds(workspaceId: string): Promise<Array<string>> {
        const rows = await this.entityManager.query<Array<IdRow>>(SELECT_LIVE_JOBS, [workspaceId])
        return rows.flatMap((row) => (row.id === null ? [] : [row.id]))
    }

    /** One candidate, or undefined. */
    async candidate(workspaceId: string, candidateId: string): Promise<CandidateRecord | undefined> {
        const row = await this.first(
            this.entityManager.query<Array<HiringCandidatesRow>>(SELECT_CANDIDATE, [workspaceId, candidateId]),
        )
        return row === undefined ? undefined : toCandidate(row)
    }

    /** The id and name of a candidate, or undefined. */
    candidateHead(candidateId: string): Promise<CandidateHeadRow | undefined> {
        return this.first(this.entityManager.query<Array<CandidateHeadRow>>(SELECT_CANDIDATE_HEAD, [candidateId]))
    }

    /** The title, place and position of a job, or undefined. */
    jobHead(jobId: string): Promise<JobHeadRow | undefined> {
        return this.first(this.entityManager.query<Array<JobHeadRow>>(SELECT_JOB_HEAD, [jobId]))
    }

    /** The candidates whose retention period has run out. */
    async retentionDue(workspaceId: string, cutoff: Date): Promise<Array<string>> {
        const rows = await this.entityManager.query<Array<IdRow>>(SELECT_RETENTION_DUE, [
            workspaceId,
            cutoff.toISOString(),
        ])
        return rows.flatMap((row) => (row.id === null ? [] : [row.id]))
    }

    /** Whether a candidate has an interview that is proposed or confirmed. */
    async hasOpenInterview(candidateId: string): Promise<boolean> {
        const row = await this.first(this.entityManager.query<Array<IdRow>>(SELECT_OPEN_INTERVIEW, [candidateId]))
        return row !== undefined
    }

    /** The interview behind a link token, or undefined. */
    async interviewByToken(token: string): Promise<InterviewRecord | undefined> {
        const row = await this.first(
            this.entityManager.query<Array<HiringInterviewsRow>>(SELECT_INTERVIEW_BY_TOKEN, [token]),
        )
        return row === undefined ? undefined : toInterview(row)
    }

    /** The confirmed interviews that start between two moments and were not reminded. */
    async dueReminders(workspaceId: string, from: Date, until: Date): Promise<Array<InterviewRecord>> {
        const rows = await this.entityManager.query<Array<HiringInterviewsRow>>(SELECT_DUE_REMINDERS, [
            workspaceId,
            from.toISOString(),
            until.toISOString(),
        ])
        return rows.map(toInterview)
    }

    /** The times an interviewer is taken: confirmed times and the times offered to candidates. */
    async busy(workspaceId: string, userId: string): Promise<Array<Slot>> {
        const rows = await this.entityManager.query<Array<BusyRow>>(SELECT_BUSY, [workspaceId, userId])
        return rows.flatMap((row): Array<Slot> => {
            if (row.status === "confirmed" && row.slot_start !== null && row.slot_end !== null) {
                return [{ start: isoOf(row.slot_start), end: isoOf(row.slot_end) }]
            }
            return (row.proposed_slots ?? []).map((slot) => ({ start: slot.start, end: slot.end }))
        })
    }

    /** The weekly windows a member declared. */
    async availability(workspaceId: string, userId: string): Promise<Array<AvailabilityWindow>> {
        const rows = await this.entityManager.query<Array<AvailabilityRow>>(SELECT_AVAILABILITY, [workspaceId, userId])
        return rows.map((row) => ({ weekday: row.weekday, startMin: row.start_min, endMin: row.end_min }))
    }

    /** The name of an active member, or undefined when the account is not one. */
    memberName(workspaceId: string, userId: string): Promise<MemberNameRow | undefined> {
        return this.first(this.entityManager.query<Array<MemberNameRow>>(SELECT_MEMBER_NAME, [workspaceId, userId]))
    }

    /** The active members, the owner first. */
    async interviewers(workspaceId: string): Promise<Array<Interviewer>> {
        const rows = await this.entityManager.query<Array<InterviewerRow>>(SELECT_INTERVIEWERS, [workspaceId])
        return rows.map((row) => ({ userId: row.user_id, name: row.display_name, isOwner: row.is_owner }))
    }

    /** One offer, or undefined. */
    async offer(workspaceId: string, offerId: string): Promise<OfferRecord | undefined> {
        const row = await this.first(
            this.entityManager.query<Array<HiringOffersRow>>(SELECT_OFFER, [workspaceId, offerId]),
        )
        return row === undefined ? undefined : toOffer(row)
    }

    /** The offer behind a link token, or undefined. */
    async offerByToken(token: string): Promise<OfferRecord | undefined> {
        const row = await this.first(this.entityManager.query<Array<HiringOffersRow>>(SELECT_OFFER_BY_TOKEN, [token]))
        return row === undefined ? undefined : toOffer(row)
    }

    /** Whether a candidate has an offer that is a draft, waiting or sent. */
    async hasActiveOffer(candidateId: string): Promise<boolean> {
        const row = await this.first(this.entityManager.query<Array<IdRow>>(SELECT_ACTIVE_OFFER, [candidateId]))
        return row !== undefined
    }

    /** The channel of a chat conversation, or null. */
    async conversationChannel(conversationId: string): Promise<string | null> {
        const row = await this.first(
            this.entityManager.query<Array<ChannelRow>>(SELECT_CONVERSATION_CHANNEL, [conversationId]),
        )
        return row?.channel ?? null
    }

    /** A fresh unguessable token for a link or an upload folder. */
    async newToken(): Promise<string> {
        const row = await this.first(this.entityManager.query<Array<TextRow>>(NEW_TOKEN, []))
        return row?.value ?? ""
    }

    /** How many times an action was asked with one dedupe prefix, so a repeated ask gets a fresh key. */
    async askAttempts(workspaceId: string, action: string, prefix: string): Promise<number> {
        const row = await this.first(
            this.entityManager.query<Array<CountRow>>(COUNT_ASKS, [workspaceId, action, `${prefix}%`]),
        )
        return Number(row?.count ?? 0)
    }
}
