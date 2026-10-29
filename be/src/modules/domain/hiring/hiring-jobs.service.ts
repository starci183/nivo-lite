import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog, ModuleTextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { JobRecord } from "./hiring.contracts"
import type {
    GenerateAdOutput,
    GenerateAdParams,
    SaveJobOutput,
    SaveJobParams,
    SetJobStatusOutput,
    SetJobStatusParams,
} from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { fairnessMessage } from "./policies/fairness-message.policy"
import { findFairnessViolations, stripUnfairLines, validateJobDraft } from "./policies/fairness.policy"
import {
    cleanChannels,
    cleanHeadcount,
    cleanMoney,
    cleanQuestions,
    cleanRequirements,
} from "./policies/job-input.policy"
import { parseLooseJson, textField } from "./policies/json.policy"
import { payPhrase } from "./policies/offer-letter.policy"
import { requirementsJson, questionsJson } from "./policies/row-mappers.policy"
import { experienceLine } from "./policies/screening.policy"
import { clip, slugify } from "./policies/text.policy"

const TITLE_MIN = 3
const TITLE_MAX = 140
const DESCRIPTION_MAX = 6000
const POSITION_MAX = 120
const SCHEDULE_MAX = 300
const LOCATION_MAX = 300
const SLUG_TRIES = 30
const SLUG_MAX = 60
const AD_ATTEMPTS = 2
const AD_TIMEOUT_MS = 100_000

@Injectable()
/** The job posts: writing and opening them under the fairness check, and drafting the copy-ready ads. */
export class HiringJobsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly generator: ModuleTextGenerator,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
        private readonly settings: HiringSettingsService,
        private readonly links: HiringLinksService,
        private readonly office: OfficeLog,
    ) {}

    /** Creates or updates a job post. Every text is checked for protected traits first; a refusal quotes the words and says what to write instead. */
    async saveJob(userId: string, workspaceId: string, request: SaveJobParams): Promise<SaveJobOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const title = clip(request.title, TITLE_MAX)
        if (title.length < TITLE_MIN) throw new HiringError({ code: HiringErrorCode.JobTitleInvalid })
        const requirements = cleanRequirements(request.requirements)
        const questions = cleanQuestions(request.questions)
        const description = clip(request.description ?? "", DESCRIPTION_MAX)
        const min = cleanMoney(request.payMinVnd)
        const max = cleanMoney(request.payMaxVnd)
        if (min !== null && max !== null && min > max) throw new HiringError({ code: HiringErrorCode.PayRangeInvalid })
        const position = clip(request.position ?? "", POSITION_MAX)
        const schedule = clip(request.schedule ?? "", SCHEDULE_MAX)
        this.refuseUnfair(validateJobDraft({ title, position, description, schedule, requirements, questions }))
        const fields = JSON.stringify({
            title,
            position,
            employmentType: request.employmentType === "part_time" ? "part_time" : "full_time",
            schedule,
            payMinVnd: min,
            payMaxVnd: max,
            payUnit: request.payUnit === "hour" || request.payUnit === "shift" ? request.payUnit : "month",
            location: clip(request.location ?? "", LOCATION_MAX),
            headcount: cleanHeadcount(request.headcount),
            description,
            requirements: requirementsJson(requirements),
            questions: questionsJson(questions),
            channels: cleanChannels(request.channels),
            closesAt:
                request.closesAt === undefined || request.closesAt === null
                    ? null
                    : new Date(request.closesAt).toISOString(),
        })
        if (request.id !== undefined) return this.update(workspaceId, request.id, fields)
        return this.create(workspaceId, userId, slugify(title, SLUG_MAX) || "tuyen-dung", fields, 0)
    }

    private async update(workspaceId: string, id: string, fields: string): Promise<SaveJobOutput> {
        const [row] = await callDbFunction<{ hiring_job_update: boolean }>(
            this.entityManager,
            "public.hiring_job_update",
            [workspaceId, id, fields],
        )
        const job = row?.hiring_job_update === true ? await this.data.job(workspaceId, id) : undefined
        if (job === undefined) throw new HiringError({ code: HiringErrorCode.JobNotFound })
        return { id: job.id, slug: job.slug }
    }

    private async create(
        workspaceId: string,
        userId: string,
        base: string,
        fields: string,
        attempt: number,
    ): Promise<SaveJobOutput> {
        if (attempt >= SLUG_TRIES) throw new HiringError({ code: HiringErrorCode.JobSlugUnavailable })
        const slug = attempt === 0 ? base : `${base}-${attempt + 1}`
        const [row] = await callDbFunction<{ hiring_job_create: string | null }>(
            this.entityManager,
            "public.hiring_job_create",
            [workspaceId, userId, slug, fields],
        )
        return row?.hiring_job_create === null || row?.hiring_job_create === undefined
            ? this.create(workspaceId, userId, base, fields, attempt + 1)
            : { id: row.hiring_job_create, slug }
    }

    private refuseUnfair(violations: ReturnType<typeof validateJobDraft>): void {
        if (violations.length > 0) {
            throw new HiringError({
                code: HiringErrorCode.Unfair,
                params: { detail: fairnessMessage(violations, this.words.textOf) },
            })
        }
    }

    /** One job of the workspace; throws when there is none. */
    async requireJob(workspaceId: string, jobId: string): Promise<JobRecord> {
        const job = await this.data.job(workspaceId, jobId)
        if (job === undefined) throw new HiringError({ code: HiringErrorCode.JobNotFound })
        return job
    }

    /** Opens, pauses or closes a job. Opening checks the texts again so a row written another way never goes public with a discriminatory requirement. */
    async setStatus(userId: string, workspaceId: string, request: SetJobStatusParams): Promise<SetJobStatusOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const job = await this.requireJob(workspaceId, request.id)
        if (request.status === "open") {
            this.refuseUnfair(
                validateJobDraft({
                    title: job.title,
                    position: job.position,
                    description: job.description,
                    schedule: job.schedule,
                    requirements: job.requirements,
                    questions: job.questions,
                }),
            )
            const empty =
                job.description.trim() === "" &&
                job.requirements.skills.length === 0 &&
                job.requirements.mustHave.length === 0
            if (empty) throw new HiringError({ code: HiringErrorCode.JobNeedsContent })
            await this.settings.ensure(workspaceId)
        }
        await callDbFunction<{ hiring_job_status: boolean }>(this.entityManager, "public.hiring_job_status", [
            workspaceId,
            job.id,
            request.status,
        ])
        return { status: request.status }
    }

    /** The facts of a job, one per line, that the ad and the letters are written from. */
    jobFacts(job: JobRecord): string {
        const t = this.words.textOf
        const requirements = job.requirements
        const experience = experienceLine(requirements.experienceYears, requirements.experienceNote, "facts", t)
        const list = (key: string, items: ReadonlyArray<string>, glue: string): string =>
            items.length === 0 ? "" : t(key, { list: items.join(glue) })
        return [
            t("hiring.facts.title", { title: job.title }),
            job.position === "" ? "" : t("hiring.facts.position", { position: job.position }),
            t("hiring.facts.employment", { employment: t(`hiring.employment.${job.employmentType}`, {}) }),
            job.schedule === "" ? "" : t("hiring.facts.schedule", { schedule: job.schedule }),
            t("hiring.facts.pay", { pay: payPhrase(job, t, (amount) => this.words.amount(amount)) }),
            job.location === "" ? "" : t("hiring.facts.place", { place: job.location }),
            t("hiring.facts.headcount", { count: job.headcount }),
            job.description === "" ? "" : t("hiring.facts.description", { description: job.description }),
            list("hiring.facts.skills", requirements.skills, ", "),
            experience,
            list("hiring.facts.availability", requirements.availability, ", "),
            list("hiring.facts.mustHave", requirements.mustHave, "; "),
            list("hiring.facts.niceToHave", requirements.niceToHave, "; "),
        ]
            .filter((line) => line !== "")
            .join("\n")
    }

    /** Drafts the three copy-ready ads of a job (a Facebook group post, a Zalo message, a job board post) and keeps them on the job. */
    async generateAd(userId: string, workspaceId: string, request: GenerateAdParams): Promise<GenerateAdOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const job = await this.requireJob(workspaceId, request.jobId)
        const settings = await this.settings.ensure(workspaceId)
        const shop = await this.office.workspaceName(workspaceId)
        const link = this.links.job(settings.publicSlug, job.slug)
        const user = this.words.text("hiring.ad.user", { shop, tone: settings.adTone, facts: this.jobFacts(job) })
        const startedAt = this.clock.now().getTime()
        const drafted = await this.draft(workspaceId, user, "", 1)
        if (drafted === null) throw new HiringError({ code: HiringErrorCode.AdFailed })
        const fill = (text: string): string =>
            text.includes("{{link}}")
                ? text.split("{{link}}").join(link)
                : `${text}\n\n${this.words.text("hiring.ad.apply", { link })}`
        const generatedAt = this.clock.now().toISOString()
        const ms = this.clock.now().getTime() - startedAt
        const ads = {
            facebook: fill(drafted.facebook),
            zalo: fill(drafted.zalo),
            topcv: fill(drafted.topcv),
            generated_at: generatedAt,
            ms,
        }
        await callDbFunction<{ hiring_job_ads: boolean }>(this.entityManager, "public.hiring_job_ads", [
            workspaceId,
            job.id,
            JSON.stringify(ads),
        ])
        return {
            facebook: ads.facebook,
            zalo: ads.zalo,
            topcv: ads.topcv,
            generatedAt,
            ms,
            attempts: drafted.attempts,
            sanitised: drafted.sanitised,
        }
    }

    /** Asks the model for the ads, at most twice, and keeps only text free of protected traits. */
    private async draft(
        workspaceId: string,
        user: string,
        feedback: string,
        attempt: number,
    ): Promise<{ facebook: string; zalo: string; topcv: string; attempts: number; sanitised: boolean } | null> {
        const written = await this.generator.generate({
            workspaceId,
            purpose: "hiring_job_ad",
            module: "hiring",
            system: this.words.text("hiring.ad.system"),
            user: user + feedback,
            timeoutMs: AD_TIMEOUT_MS,
        })
        if (!written.ok) throw new HiringError({ code: HiringErrorCode.AdFailed })
        const parsed = parseLooseJson(written.output)
        const got = {
            facebook: textField(parsed, "facebook"),
            zalo: textField(parsed, "zalo"),
            topcv: textField(parsed, "topcv"),
        }
        const again = attempt < AD_ATTEMPTS
        if (got.facebook === "" || got.zalo === "" || got.topcv === "") {
            return again ? this.draft(workspaceId, user, this.words.text("hiring.ad.badFormat"), attempt + 1) : null
        }
        const bad = [got.facebook, got.zalo, got.topcv].flatMap((text) => findFairnessViolations(text))
        if (bad.length === 0) return { ...got, attempts: attempt, sanitised: false }
        if (again) {
            const traits = [...new Set(bad.map((item) => this.words.text(`hiring.fairness.${item.category}`)))].join(
                ", ",
            )
            return this.draft(workspaceId, user, this.words.text("hiring.ad.unfair", { traits }), attempt + 1)
        }
        return {
            facebook: stripUnfairLines(got.facebook),
            zalo: stripUnfairLines(got.zalo),
            topcv: stripUnfairLines(got.topcv),
            attempts: attempt,
            sanitised: true,
        }
    }
}
