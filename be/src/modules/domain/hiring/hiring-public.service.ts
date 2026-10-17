import { Injectable } from "@nestjs/common"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { CvStorage } from "./cv-storage.port"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { JobRecord } from "./hiring.contracts"
import type {
    ApplyOutput,
    ApplyParams,
    CreateCvUploadOutput,
    CreateCvUploadParams,
    PublicJobOutput,
    PublicJobParams,
} from "./hiring-public.contracts"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringChatService } from "./hiring-chat.service"
import type { ChatApplication, ChatRegistration } from "./hiring-chat.service"
import { HiringPostingService } from "./hiring-posting.service"
import { HiringDataService } from "./hiring-data.service"
import { slugify } from "./policies/text.policy"

const CV_EXTENSIONS: ReadonlyArray<string> = ["pdf", "doc", "docx", "jpg", "jpeg", "png"]
const CV_MIME: Readonly<Record<string, string>> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
}
const CV_NAME_MAX = 40
const CV_SIZE_UNKNOWN = 0

@Injectable()
/**
 * What the public may do without an account: read an open job, send an application with a CV in the page of a business, or apply in the
 * shop chat (the chatbot gets the open jobs for its turn and hands over the application it took).
 */
export class HiringPublicService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly office: OfficeLog,
        private readonly storage: CvStorage,
        private readonly data: HiringDataService,
        private readonly candidates: HiringCandidatesService,
        private readonly chat: HiringChatService,
        private readonly posting: HiringPostingService,
    ) {}

    /** The open jobs a shop chat turn may take applications for, with the rules; empty when none is open for chat. */
    chatBrief(workspaceId: string): Promise<string> {
        return this.chat.brief(workspaceId)
    }

    /** Stores an application the shop chatbot took, with the consent given in the conversation; never throws. */
    registerChatApplication(
        workspaceId: string,
        conversationId: string,
        application: ChatApplication,
    ): Promise<ChatRegistration> {
        return this.chat.register(workspaceId, conversationId, application)
    }

    private async resolve(
        request: PublicJobParams,
    ): Promise<{ workspaceId: string; consentText: string; job: JobRecord }> {
        const settings = await this.data.settingsBySlug(request.ws)
        const job = settings === undefined ? undefined : await this.data.jobBySlug(settings.workspaceId, request.job)
        if (settings === undefined || job === undefined || job.status === "draft")
            throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        return { workspaceId: settings.workspaceId, consentText: settings.applyConsentText, job }
    }

    /** The public face of a job: nothing internal, no expectations of the scored questions. */
    async job(request: PublicJobParams): Promise<PublicJobOutput> {
        const { workspaceId, consentText, job } = await this.resolve(request)
        const closed = job.closesAt !== null && Date.parse(job.closesAt) < this.clock.now().getTime()
        return {
            title: job.title,
            position: job.position,
            employmentType: job.employmentType,
            schedule: job.schedule,
            payMinVnd: job.payMinVnd,
            payMaxVnd: job.payMaxVnd,
            payUnit: job.payUnit,
            location: job.location,
            headcount: job.headcount,
            description: job.description,
            status: job.status,
            closesAt: job.closesAt,
            company: await this.office.workspaceName(workspaceId),
            consentText,
            open: job.status === "open" && job.channels.includes("page") && !closed,
            requirements: { ...job.requirements },
            questions: job.questions.map((question) => ({
                id: question.id,
                text: question.text,
                type: question.type,
                required: question.required,
                choices: question.choices ?? [],
            })),
        }
    }

    /** A one-time place to upload a CV for a job, valid for the folder of that job only. */
    async createCvUpload(request: CreateCvUploadParams): Promise<CreateCvUploadOutput> {
        await this.posting.requireOpen(request)
        const { workspaceId, job } = await this.resolve(request)
        const dot = request.fileName.lastIndexOf(".")
        const extension = dot < 0 ? "" : request.fileName.slice(dot + 1).toLowerCase()
        if (!CV_EXTENSIONS.includes(extension)) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        const name = slugify(request.fileName.slice(0, dot), CV_NAME_MAX) || "cv"
        const path = `${workspaceId}/${job.id}/${await this.data.newToken()}/${name}.${extension}`
        const token = await this.storage.signedUpload(path)
        if (token === null) throw new HiringError({ code: HiringErrorCode.PublicNotFound })
        return { path, token }
    }

    /** Takes an application from the public page. A filled honeypot field is answered like a success and stores nothing. */
    async apply(request: ApplyParams, ipHash?: string): Promise<ApplyOutput> {
        await this.posting.requireOpen(request)
        if ((request.website ?? "").trim() !== "") return { duplicate: false }
        const { workspaceId, job } = await this.resolve(request)
        if (!job.channels.includes("page")) throw new HiringError({ code: HiringErrorCode.JobNotOpen })
        const folder = `${workspaceId}/${job.id}/`
        const cvPath =
            request.cvPath !== undefined && request.cvPath.startsWith(folder) && !request.cvPath.includes("..")
                ? request.cvPath
                : undefined
        const extension = (cvPath ?? "").slice((cvPath ?? "").lastIndexOf(".") + 1).toLowerCase()
        const submitted = await this.candidates.submit(
            workspaceId,
            job,
            "page",
            {
                name: request.name,
                phone: request.phone,
                email: request.email,
                availability: request.availability,
                consent: request.consent,
                answers: request.answers,
            },
            {
                ...(ipHash === undefined ? {} : { ipHash }),
                ...(cvPath === undefined
                    ? {}
                    : {
                          cv: {
                              path: cvPath,
                              name: (request.cvName ?? "cv").slice(0, CV_NAME_MAX * 2),
                              mime: CV_MIME[extension] ?? "application/octet-stream",
                              size: CV_SIZE_UNKNOWN,
                          },
                      }),
            },
        )
        return { duplicate: submitted.duplicate }
    }
}
