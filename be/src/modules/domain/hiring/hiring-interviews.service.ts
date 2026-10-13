import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { InterviewRecord } from "./hiring.contracts"
import type {
    RequestInterviewOutput,
    RequestInterviewParams,
    SaveAvailabilityOutput,
    SaveAvailabilityParams,
    SetInterviewStatusParams,
} from "./hiring-operations.contracts"
import type {
    PublicInterviewOutput,
    PublicInterviewParams,
    RespondSlotOutput,
    RespondSlotParams,
} from "./hiring-public.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringTextService } from "./hiring-text.service"
import {
    CLAIM_REMINDER,
    CONFIRM_INTERVIEW,
    LOG_EVENT,
    CREATE_INTERVIEW,
    NONE_FIT_INTERVIEW,
    SAVE_AVAILABILITY,
    SET_INTERVIEW_STATUS,
} from "./persistence/hiring.sql"
import type { FlagRow, IdRow } from "./persistence/hiring.rows"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { fieldNumber, fieldText } from "./policies/gate-fields.policy"
import { DEFAULT_WINDOWS, computeSlots } from "./policies/slots.policy"
import { isToken } from "./policies/text.policy"

const DURATION_MIN = 15
const DURATION_MAX = 180
const DURATION_DEFAULT = 30
const LOCATION_MAX = 300
const MINUTES_PER_DAY = 1440
const LAST_WEEKDAY = 6

@Injectable()
/** Interviews: proposing times from the interviewer availability, the candidate picking one on a link, reminders and the status afterwards. */
export class HiringInterviewsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly gate: ApprovalGate,
        private readonly office: OfficeLog,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly links: HiringLinksService,
        private readonly notify: HiringNotifyService,
        private readonly candidates: HiringCandidatesService,
    ) {}

    /** The interviewer: the chosen member, otherwise the workspace owner, otherwise the first member. */
    private async interviewer(
        workspaceId: string,
        userId: string | undefined,
    ): Promise<{ userId: string; name: string }> {
        if (userId !== undefined) {
            const member = await this.data.memberName(workspaceId, userId)
            if (member === undefined) throw new HiringError({ code: HiringErrorCode.InterviewerNotMember })
            return { userId, name: member.display_name }
        }
        const [first] = await this.data.interviewers(workspaceId)
        if (first === undefined) throw new HiringError({ code: HiringErrorCode.InterviewerMissing })
        return { userId: first.userId, name: first.name }
    }

    /** Asks the gate to invite a candidate to an interview; the performer proposes the times and sends them. */
    async request(
        userId: string,
        workspaceId: string,
        request: RequestInterviewParams,
    ): Promise<RequestInterviewOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const candidate = await this.candidates.requireOpenCandidate(workspaceId, request.candidateId)
        if (await this.data.hasOpenInterview(candidate.id))
            throw new HiringError({ code: HiringErrorCode.InterviewOpen })
        const who = await this.interviewer(workspaceId, request.interviewerUserId)
        const location = request.location.trim().slice(0, LOCATION_MAX)
        if (request.mode === "online" && location === "")
            throw new HiringError({ code: HiringErrorCode.OnlineLinkRequired })
        const attempts = await this.data.askAttempts(
            workspaceId,
            "schedule_interview",
            `schedule_interview:${candidate.id}:`,
        )
        const outcome = await this.gate.request({
            workspaceId,
            actor: displayName,
            action: "schedule_interview",
            subjectType: "candidate",
            subjectId: candidate.id,
            dedupeKey: `schedule_interview:${candidate.id}:${attempts + 1}`,
            summary: this.words.text("hiring.interview.summary", { name: candidate.name }),
            fields: {
                candidate_id: candidate.id,
                interviewer_user_id: who.userId,
                interviewer_name: who.name,
                mode: request.mode,
                location,
                duration_min: Math.max(DURATION_MIN, Math.min(DURATION_MAX, request.durationMin || DURATION_DEFAULT)),
            },
        })
        return {
            status: outcome.status,
            summary: this.words.text("hiring.interview.asked", { name: candidate.name }),
            error: null,
        }
    }

    /** The performer of schedule_interview: proposes times from the interviewer availability, stores them and sends the link to the candidate. */
    async perform(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const candidate = await this.candidates.requireCandidate(workspaceId, fieldText(context.fields, "candidate_id"))
        const job = await this.data.jobHead(candidate.jobId)
        const interviewerId = fieldText(context.fields, "interviewer_user_id")
        const duration = fieldNumber(context.fields, "duration_min") || DURATION_DEFAULT
        const declared = await this.data.availability(workspaceId, interviewerId)
        const usedDefault = declared.length === 0
        const busy = await this.data.busy(workspaceId, interviewerId)
        const slots = computeSlots(usedDefault ? DEFAULT_WINDOWS : declared, busy, duration, this.clock.now())
        if (slots.length === 0) throw new HiringError({ code: HiringErrorCode.NoSlots })
        const mode = fieldText(context.fields, "mode") === "online" ? "online" : "in_person"
        const location = fieldText(context.fields, "location") || job?.location || ""
        const interviewerName = fieldText(context.fields, "interviewer_name")
        const token = await this.data.newToken()
        const line = this.words.text("hiring.event.interviewProposed", {
            count: slots.length,
            who: interviewerName === "" ? this.words.text("hiring.interview.someone") : interviewerName,
            fallback: usedDefault ? this.words.text("hiring.interview.defaultWindow") : "",
        })
        await this.entityManager.query<Array<IdRow>>(CREATE_INTERVIEW, [
            workspaceId,
            candidate.id,
            candidate.jobId,
            JSON.stringify({
                interviewerUserId: interviewerId === "" ? null : interviewerId,
                interviewerName,
                mode,
                location,
                durationMin: duration,
                slots,
            }),
            token,
            context.workItemId,
            context.actor,
            line,
        ])
        const link = this.links.interview(token)
        const shop = await this.office.workspaceName(workspaceId)
        const text = this.words.text("hiring.interview.invite", {
            name: candidate.name,
            title: job?.title ?? "",
            shop,
            where: this.words.text(`hiring.interview.${mode}`),
            place: location === "" ? "" : ` (${location})`,
            minutes: duration,
            slots: slots.map((slot) => `- ${this.words.when(slot.start)}`).join("\n"),
            link,
        })
        const delivery = await this.notify.toCandidate(candidate, {
            subject: this.words.text("hiring.interview.subject", { title: job?.title ?? "" }),
            text,
            workItemId: context.workItemId,
        })
        return {
            summary: this.words.text("hiring.interview.proposed", {
                count: slots.length,
                name: candidate.name,
                note: delivery.note,
            }),
            evidence: "captured",
            ...(delivery.delivered ? {} : { detail: link }),
        }
    }

    /** What a candidate sees on the link of an interview. */
    async publicView(request: PublicInterviewParams): Promise<PublicInterviewOutput> {
        const interview = await this.byToken(request.token)
        const heads = await this.data.heads(interview.candidateId, interview.jobId)
        if (heads === undefined) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        return {
            status: interview.status,
            candidateName: heads.candidateName,
            jobTitle: heads.jobTitle,
            shop: await this.office.workspaceName(interview.workspaceId),
            mode: interview.mode,
            location: interview.location,
            durationMin: interview.durationMin,
            interviewerName: interview.interviewerName,
            slotStart: interview.slotStart,
            note: interview.note,
            proposedSlots: interview.proposedSlots.map((slot) => ({ start: slot.start, end: slot.end })),
        }
    }

    private async byToken(token: string): Promise<InterviewRecord> {
        const interview = isToken(token) ? await this.data.interviewByToken(token) : undefined
        if (interview === undefined) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        return interview
    }

    /** The candidate picks one of the proposed times, or says none fits. A pick confirms the interview once; a second click changes nothing. */
    async respond(request: RespondSlotParams): Promise<RespondSlotOutput> {
        if (!isToken(request.token)) return { outcome: "invalid", slotStart: null }
        const interview = await this.data.interviewByToken(request.token)
        if (interview === undefined) return { outcome: "invalid", slotStart: null }
        if (interview.status === "confirmed") return { outcome: "already_confirmed", slotStart: interview.slotStart }
        if (interview.status !== "proposed") return { outcome: "closed", slotStart: null }
        const candidate = await this.data.candidateHead(interview.candidateId)
        const job = await this.data.jobHead(interview.jobId)
        const name = candidate?.name ?? ""
        const title = job?.title ?? ""
        if (request.start === undefined) {
            await this.entityManager.query<Array<FlagRow>>(NONE_FIT_INTERVIEW, [
                request.token,
                this.words.text("hiring.interview.noneFitNote"),
                this.words.text("hiring.event.noneFit"),
            ])
            await this.office.postOffice(
                interview.workspaceId,
                this.words.text("hiring.office.noneFit", { name, title }),
            )
            return { outcome: "none_fit", slotStart: null }
        }
        const slot = interview.proposedSlots.find((item) => item.start === request.start)
        if (slot === undefined) return { outcome: "not_offered", slotStart: null }
        const when = this.words.when(slot.start)
        const [row] = await this.entityManager.query<Array<FlagRow>>(CONFIRM_INTERVIEW, [
            request.token,
            slot.start,
            slot.end,
            this.words.text("hiring.event.interviewConfirmed", { when }),
        ])
        if (row?.value !== true) return { outcome: "stale", slotStart: null }
        await this.office.postOffice(
            interview.workspaceId,
            this.words.text("hiring.office.interviewConfirmed", {
                name,
                title,
                when,
                who:
                    interview.interviewerName === ""
                        ? ""
                        : this.words.text("hiring.office.withWho", { who: interview.interviewerName }),
            }),
        )
        return { outcome: "confirmed", slotStart: slot.start }
    }

    /** Sets an interview done, cancelled or missed. */
    async setStatus(userId: string, workspaceId: string, request: SetInterviewStatusParams): Promise<void> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const [row] = await this.entityManager.query<Array<IdRow>>(SET_INTERVIEW_STATUS, [
            workspaceId,
            request.id,
            request.status,
            displayName,
            this.words.text(`hiring.event.interview_${request.status}`),
        ])
        if (row?.id === null || row?.id === undefined)
            throw new HiringError({ code: HiringErrorCode.InterviewNotFound })
    }

    /** Replaces the weekly availability windows of a member. */
    async saveAvailability(
        userId: string,
        workspaceId: string,
        request: SaveAvailabilityParams,
    ): Promise<SaveAvailabilityOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if ((await this.data.memberName(workspaceId, request.memberUserId)) === undefined) {
            throw new HiringError({ code: HiringErrorCode.MemberNotFound })
        }
        const valid = request.windows.filter(
            (window) =>
                Number.isInteger(window.weekday) &&
                window.weekday >= 0 &&
                window.weekday <= LAST_WEEKDAY &&
                window.startMin >= 0 &&
                window.endMin <= MINUTES_PER_DAY &&
                window.endMin > window.startMin,
        )
        if (valid.length !== request.windows.length)
            throw new HiringError({ code: HiringErrorCode.AvailabilityInvalid })
        const [row] = await this.entityManager.query<Array<{ value: number }>>(SAVE_AVAILABILITY, [
            workspaceId,
            request.memberUserId,
            JSON.stringify(valid),
        ])
        return { saved: row?.value ?? 0 }
    }

    /** Sends the reminder of a confirmed interview once; answers whether this call sent it. */
    async remind(interview: InterviewRecord, shop: string): Promise<boolean> {
        if (interview.slotStart === null) return false
        const [claim] = await this.entityManager.query<Array<FlagRow>>(CLAIM_REMINDER, [interview.id])
        if (claim?.value !== true) return false
        const candidate = await this.data.candidate(interview.workspaceId, interview.candidateId)
        const job = await this.data.jobHead(interview.jobId)
        if (candidate === undefined) return false
        const when = this.words.when(interview.slotStart)
        const place = interview.location === "" ? "" : ` (${interview.location})`
        const title = job?.title ?? ""
        const delivery =
            interview.workItemId === null
                ? null
                : await this.notify.toCandidate(candidate, {
                      subject: this.words.text("hiring.interview.reminderSubject", { title }),
                      text: this.words.text("hiring.interview.reminder", {
                          name: candidate.name,
                          title,
                          when,
                          place,
                          shop,
                      }),
                      workItemId: interview.workItemId,
                  })
        await this.entityManager.query(LOG_EVENT, [
            interview.workspaceId,
            candidate.id,
            "interview_reminder",
            this.words.text("hiring.actor"),
            this.words.text("hiring.event.reminder", { when, note: delivery?.note ?? "" }),
        ])
        await this.office.postOffice(
            interview.workspaceId,
            this.words.text("hiring.office.reminder", {
                name: candidate.name,
                title,
                when,
                who:
                    interview.interviewerName === ""
                        ? ""
                        : this.words.text("hiring.office.withWho", { who: interview.interviewerName }),
            }),
        )
        return true
    }
}
