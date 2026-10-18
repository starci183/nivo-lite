import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { JobRecord } from "./hiring.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringTextService } from "./hiring-text.service"
import { payPhrase } from "./policies/offer-letter.policy"
import { criteriaText } from "./policies/screening.policy"

/** An application the shop chatbot proposes from a conversation; it is validated again before anything is stored. */
export interface ChatApplication {
    /** The slug of the job. */
    readonly job: string
    /** The applicant name. */
    readonly name: string
    /** The phone number. */
    readonly phone: string
    /** The email address. */
    readonly email: string
    /** Whether the applicant clearly agreed to the storing of the application. */
    readonly consent: boolean
    /** The days and hours they can work. */
    readonly availability: string
    /** The answers to the questions of the job. */
    readonly answers: ReadonlyArray<{ readonly questionId: string; readonly answer: string }>
}

/** What registering a chat application answered. */
export interface ChatRegistration {
    /** Whether the application was stored. */
    readonly ok: boolean
    /** One line to log. */
    readonly message: string
    /** The candidate, when stored. */
    readonly candidateId?: string
}

@Injectable()
/** Hiring through the chat channel: the open jobs the shop chatbot may take applications for, and the application it proposes. */
export class HiringChatService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly candidates: HiringCandidatesService,
    ) {}

    private jobLine(job: JobRecord): string {
        const t = this.words.textOf
        const questions = job.questions
            .map((question) => {
                const offered = question.type === "choice" ? (question.choices ?? []) : []
                const choices = offered.length > 0 ? t("hiring.chat.choices", { list: offered.join(" / ") }) : ""
                return t("hiring.chat.question", {
                    id: question.id,
                    star: question.required ? "*" : "",
                    text: question.text,
                    choices,
                })
            })
            .join("\n")
        return t("hiring.chat.job", {
            slug: job.slug,
            title: job.title,
            employment: t(`hiring.employment.${job.employmentType}`, {}),
            pay: payPhrase(job, t, (amount) => this.words.amount(amount)),
            place: job.location === "" ? t("hiring.chat.noPlace", {}) : job.location,
            schedule: job.schedule,
            criteria: criteriaText(job, t).split("\n").slice(1).join("; ") || t("hiring.chat.noCriteria", {}),
            questions: questions === "" ? t("hiring.chat.noQuestions", {}) : questions,
        })
    }

    /** The block appended to a chat turn: the open jobs and the rules for taking an application; empty when nothing is open for chat. */
    async brief(workspaceId: string): Promise<string> {
        const now = this.clock.now().getTime()
        const open = (await this.data.chatJobs(workspaceId)).filter(
            (job) => job.closesAt === null || Date.parse(job.closesAt) >= now,
        )
        if (open.length === 0) return ""
        return this.words.text("hiring.chat.brief", {
            clause: this.words.text("hiring.chat.clause"),
            shape: this.words.text("hiring.chat.shape"),
            jobs: open.map((job) => this.jobLine(job)).join("\n"),
        })
    }

    /** Stores an application proposed by the chatbot, with the consent given in the conversation. It never throws. */
    async register(
        workspaceId: string,
        conversationId: string,
        application: ChatApplication,
    ): Promise<ChatRegistration> {
        try {
            const job = await this.data.jobBySlug(workspaceId, application.job)
            if (!job?.channels.includes("chat")) {
                return { ok: false, message: this.words.text("hiring.chat.noJob") }
            }
            const submitted = await this.candidates.submit(workspaceId, job, "chat", application, { conversationId })
            return {
                ok: true,
                message: this.words.text(submitted.duplicate ? "hiring.chat.duplicate" : "hiring.chat.stored"),
                candidateId: submitted.candidateId,
            }
        } catch (cause) {
            return { ok: false, message: cause instanceof Error ? cause.message : String(cause) }
        }
    }
}
