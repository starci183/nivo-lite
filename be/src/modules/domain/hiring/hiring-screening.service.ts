import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate, ModuleTextGenerator } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { HiringError, HiringErrorCode } from "./errors/hiring.error"
import type { OptionalGateOutcome, ScoreLabel, ScoreReason } from "./hiring.contracts"
import { HiringLogEvent } from "./hiring.log-events"
import type { RescreenOutput, RescreenParams } from "./hiring-operations.contracts"
import { HiringDataService } from "./hiring-data.service"
import { HiringTextService } from "./hiring-text.service"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { findFairnessViolations, scrubProtected } from "./policies/fairness.policy"
import { parseJson, parseLooseJson, textField, textList } from "./policies/json.policy"
import { fieldNumber, fieldText } from "./policies/gate-fields.policy"
import { criteriaText, screenAgainstRequirements } from "./policies/screening.policy"

const AI_TIMEOUT_MS = 75_000
const SUMMARY_MAX = 700
const QUESTIONS_MAX = 3
const MAX_SCORE = 100

const isScoreLabel = (value: string): value is ScoreLabel =>
    value === "fit" || value === "consider" || value === "not_fit"

const reasonsOf = (json: string): Array<ScoreReason> => {
    const parsed = parseJson(json)
    if (!parsed.ok || !Array.isArray(parsed.value)) return []
    return parsed.value.flatMap((entry: unknown): Array<ScoreReason> => {
        const item: Record<string, unknown> =
            typeof entry === "object" && entry !== null ? Object.fromEntries(Object.entries(entry)) : {}
        const status = item.status
        return typeof item.criterion === "string" &&
            typeof item.note === "string" &&
            (status === "met" || status === "unmet" || status === "unknown")
            ? [{ criterion: item.criterion, status, note: item.note }]
            : []
    })
}

const questionsOf = (json: string): Array<string> => {
    const parsed = parseJson(json)
    return parsed.ok && Array.isArray(parsed.value)
        ? parsed.value.filter((entry): entry is string => typeof entry === "string")
        : []
}

@Injectable()
/** Screening a candidate against the written job criteria: a deterministic checklist plus a short model summary, advisory only, put through the gate. */
export class HiringScreeningService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly members: WorkspaceMembersService,
        private readonly gate: ApprovalGate,
        private readonly generator: ModuleTextGenerator,
        private readonly data: HiringDataService,
        private readonly words: HiringTextService,
    ) {}

    /**
     * Prepares the screening of a candidate and puts it through the gate (screen_candidate): the score and the model summary are in the
     * request, the performer stores them. It never throws; null means the gate could not be asked and the candidate keeps waiting.
     */
    async requestScreening(workspaceId: string, candidateId: string, again: boolean): Promise<OptionalGateOutcome> {
        try {
            return await this.ask(workspaceId, candidateId, again)
        } catch (cause) {
            this.logger.error(HiringLogEvent.AskFailed, { candidateId, cause })
            return null
        }
    }

    private async ask(workspaceId: string, candidateId: string, again: boolean): Promise<OptionalGateOutcome> {
        const candidate = await this.data.candidate(workspaceId, candidateId)
        const job = candidate === undefined ? undefined : await this.data.job(workspaceId, candidate.jobId)
        if (candidate === undefined || job === undefined) return null
        const t = this.words.textOf
        const screened = screenAgainstRequirements(job, candidate, t)
        const lines = screened.reasons
            .map((reason) =>
                this.words.text("hiring.screen.line", {
                    status: this.words.text(`hiring.reasonStatus.${reason.status}`),
                    criterion: reason.criterion,
                    note: reason.note,
                }),
            )
            .join("\n")
        const answers = candidate.answers
            .map((answer) =>
                this.words.text("hiring.screen.answer", {
                    question: answer.question,
                    answer: scrubProtected(answer.answer),
                }),
            )
            .join("\n\n")
        const written = await this.generator.generate({
            workspaceId,
            purpose: "hiring_screen",
            module: "hiring",
            system: this.words.text("hiring.screen.system"),
            user: this.words.text("hiring.screen.user", {
                criteria: criteriaText(job, t),
                score: screened.score,
                lines: lines === "" ? this.words.text("hiring.screen.noCriteria") : lines,
                answers: answers === "" ? this.words.text("hiring.screen.noAnswers") : answers,
                availability: scrubProtected(candidate.availability) || this.words.text("hiring.screen.noAvailability"),
            }),
            timeoutMs: AI_TIMEOUT_MS,
        })
        const parsed = written.ok ? parseLooseJson(written.output) : null
        const summary = scrubProtected(textField(parsed, "summary")).slice(0, SUMMARY_MAX)
        const questions = textList(parsed, "interview_questions")
            .filter((question) => findFairnessViolations(question).length === 0)
            .slice(0, QUESTIONS_MAX)
        const draft = [
            summary === "" ? this.words.text("hiring.screen.noSummary") : summary,
            questions.length === 0
                ? ""
                : this.words.text("hiring.screen.questions", {
                      list: questions.map((question) => `- ${question}`).join("\n"),
                  }),
        ]
            .filter((part) => part !== "")
            .join("\n\n")
        const attempt = again
            ? (await this.data.askAttempts(workspaceId, "screen_candidate", `screen_candidate:${candidate.id}:`)) + 1
            : 0
        return this.gate.request({
            workspaceId,
            actor: this.words.text("hiring.actor"),
            action: "screen_candidate",
            subjectType: "candidate",
            subjectId: candidate.id,
            dedupeKey: again ? `screen_candidate:${candidate.id}:${attempt}` : `screen_candidate:${candidate.id}`,
            summary: this.words.text("hiring.screen.summary", {
                name: candidate.name,
                score: screened.score,
                label: this.words.text(`hiring.scoreLabel.${screened.label}`),
                title: job.title,
            }),
            draft,
            fields: {
                candidate_id: candidate.id,
                job_id: job.id,
                score: screened.score,
                label: screened.label,
                reasons: JSON.stringify(screened.reasons),
                ai_summary: summary === "" ? null : summary,
                questions: JSON.stringify(questions),
            },
        })
    }

    /** Screens a candidate again, on request of a manager. */
    async rescreen(userId: string, workspaceId: string, request: RescreenParams): Promise<RescreenOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if ((await this.data.candidate(workspaceId, request.id)) === undefined) {
            throw new HiringError({ code: HiringErrorCode.CandidateNotFound })
        }
        const outcome = await this.requestScreening(workspaceId, request.id, true)
        if (outcome === null)
            return {
                status: "failed",
                summary: this.words.text("hiring.screen.notAsked"),
                error: this.words.text("hiring.screen.notAsked"),
            }
        return { status: outcome.status, summary: this.words.text("hiring.screen.asked"), error: null }
    }

    /** The performer of screen_candidate: stores the advisory score and reasons. It never rejects; an applicant only becomes "screening". */
    async perform(context: PerformContext): Promise<PerformResult> {
        const candidate = await this.data.candidate(context.workspaceId, fieldText(context.fields, "candidate_id"))
        if (candidate === undefined) throw new HiringError({ code: HiringErrorCode.CandidateNotFound })
        const label = fieldText(context.fields, "label")
        const score = Math.max(0, Math.min(MAX_SCORE, Math.round(fieldNumber(context.fields, "score"))))
        const questions = questionsOf(fieldText(context.fields, "questions"))
        const summary =
            [
                fieldText(context.fields, "ai_summary"),
                questions.length === 0
                    ? ""
                    : this.words.text("hiring.screen.questions", {
                          list: questions.map((question) => `- ${question}`).join("\n"),
                      }),
            ]
                .filter((part) => part !== "")
                .join("\n\n") || null
        const scoreLabel = isScoreLabel(label) ? label : "consider"
        const text = this.words.text(`hiring.scoreLabel.${scoreLabel}`)
        await callDbFunction<{ hiring_candidate_screened: boolean }>(
            this.entityManager,
            "public.hiring_candidate_screened",
            [
                context.workspaceId,
                candidate.id,
                score,
                scoreLabel,
                JSON.stringify(reasonsOf(fieldText(context.fields, "reasons"))),
                summary,
                context.actor,
                this.words.text("hiring.event.screened", { score, label: text }),
            ],
        )
        return {
            summary: this.words.text("hiring.screen.done", { name: candidate.name, score, label: text }),
            evidence: "captured",
            ...(summary === null ? {} : { detail: summary }),
        }
    }
}
