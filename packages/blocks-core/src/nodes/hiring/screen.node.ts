import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused, valueOrCannot } from "../tool-answers"
import { SCREEN_GOAL } from "./hiring.policy"
import { readCandidate, readJob, CANDIDATE_TYPE, JOB_TYPE } from "./hiring.reads"
import {
    HIRING_SAMPLE,
    SAMPLE_CANDIDATE,
    SAMPLE_CANDIDATE_ID,
    SAMPLE_JOB,
    SAMPLE_JOB_ID,
    SAMPLE_QUESTIONS,
    SAMPLE_SUMMARY,
} from "./hiring.samples"

type NoParams = Record<string, never>

/** Which candidate to screen. */
export interface ScreenInput {
    /** The `blocks-core.hiring.candidate` record. */
    readonly candidateId: string
}

/** The screening as the next steps read it. */
export interface ScreenOutput {
    /** The candidate's name, for the team's line. */
    readonly name: string
    /** The job's title. */
    readonly jobTitle: string
    /** What matched the requirements and what is unclear, for the person who decides. */
    readonly summary: string
    /** The interview questions on what is unclear. */
    readonly questions: ReadonlyArray<string>
    /** True when a person declined storing the screening on the candidate's card: the candidate was not moved to `screened`. */
    readonly declined: boolean
}

/** What the agent answers. */
interface ScreenAnswer {
    readonly summary: string
    readonly questions: ReadonlyArray<string>
}

const QUESTIONS_MAX = 3
const QUESTION_MAX = 300

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<ScreenInput> = z.object({ candidateId: z.string().min(1).max(MAX_ID) })
const output: NodeSchema<ScreenOutput> = z.object({
    name: z.string().max(MAX_LINE),
    jobTitle: z.string().max(MAX_LINE),
    summary: z.string().min(1).max(MAX_BODY),
    questions: z.array(z.string().max(QUESTION_MAX)).max(QUESTIONS_MAX),
    declined: z.boolean().describe("True when a person declined storing the screening on the candidate's card: nothing was stored, the candidate was not moved to screened."),
})
const answer: NodeSchema<ScreenAnswer> = z.object({
    summary: z
        .string()
        .min(1)
        .max(MAX_LINE * 2)
        .describe("At most 70 words in Vietnamese: what meets the requirements, what is unclear"),
    questions: z
        .array(z.string().min(1).max(QUESTION_MAX))
        .max(QUESTIONS_MAX)
        .describe("Up to 3 interview questions on the unclear requirements"),
})

/** The summary the record keeps: the summary, then the questions as a list. */
const summaryText = (written: ScreenAnswer): string =>
    written.questions.length === 0
        ? written.summary
        : [written.summary, ...written.questions.map((question) => `- ${question}`)].join("\n")

/**
 * `hiring.screen` (screen a candidate): reads the candidate and their job, the agent compares what a person wrote of the CV
 * (`profile`) with the job's written requirements, under the fairness rule (no protected trait read or judged), and writes an
 * advisory summary with interview questions; the step stores it on the candidate and moves them to `screened`. It never rejects
 * anyone: a person decides. The CV file's text is not read (no core tool reads a stored file's text yet).
 */
export const hiringScreenNode: TemplateNode<
    NodeSchema<ScreenInput>,
    NodeSchema<ScreenOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "hiring.screen",
    title: bilingualOf("nodeHiringScreenTitle"),
    description: { vi: "So h\u1ed3 s\u01a1 \u1ee9ng vi\u00ean v\u1edbi y\u00eau c\u1ea7u c\u1ee7a v\u1ecb tr\u00ed, vi\u1ebft nh\u1eadn x\u00e9t tham kh\u1ea3o k\u00e8m c\u00e2u h\u1ecfi ph\u1ecfng v\u1ea5n. Kh\u00f4ng lo\u1ea1i ai: ng\u01b0\u1eddi th\u1eadt quy\u1ebft \u0111\u1ecbnh.", en: "Compares a candidate with the job's requirements and writes an advisory summary with interview questions. It never rejects anyone: a person decides." },
    tools: [],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const candidate = await readCandidate(context, given.candidateId)
        const job = await readJob(context, candidate.jobId)
        const written = await context.agent.run({
            goal: SCREEN_GOAL,
            input: {
                job: { title: job.title, description: job.description, requirements: job.requirements },
                candidate: { profile: candidate.profile, cvAttached: candidate.cvAttached },
            },
            output: answer,
            tools: [],
            maxTurns: 1,
        })
        const updated = await context.tools.call(TOOL.recordUpdate, {
            type: CANDIDATE_TYPE,
            id: candidate.id,
            patch: { stage: "screened", screeningSummary: summaryText(written) },
            version: candidate.version,
        })
        if (!updated.ok && updated.declined === true) {
            return { name: candidate.name, jobTitle: job.title, summary: written.summary, questions: written.questions, declined: true }
        }
        valueOrCannot(context, TOOL.recordUpdate, updated)
        return { name: candidate.name, jobTitle: job.title, summary: written.summary, questions: written.questions, declined: false }
    },
    examples: [
        {
            name: "screens a candidate against the job's written requirements and moves them to screened",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: CANDIDATE_TYPE, id: SAMPLE_CANDIDATE_ID },
                    answer: answered({ record: SAMPLE_CANDIDATE }),
                },
                {
                    id: TOOL.recordGet,
                    args: { type: JOB_TYPE, id: SAMPLE_JOB_ID },
                    answer: answered({ record: SAMPLE_JOB }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: {
                        type: CANDIDATE_TYPE,
                        id: SAMPLE_CANDIDATE_ID,
                        patch: {
                            stage: "screened",
                            screeningSummary: [
                                SAMPLE_SUMMARY,
                                ...SAMPLE_QUESTIONS.map((question) => `- ${question}`),
                            ].join("\n"),
                        },
                        version: "3",
                    },
                    answer: answered({ record: SAMPLE_CANDIDATE }),
                },
            ],
            agent: [{ answer: { summary: SAMPLE_SUMMARY, questions: [...SAMPLE_QUESTIONS] } }],
            output: {
                name: HIRING_SAMPLE.candidateName,
                jobTitle: HIRING_SAMPLE.jobTitle,
                summary: SAMPLE_SUMMARY,
                questions: [...SAMPLE_QUESTIONS],
                declined: false,
            },
        },
        {
            name: "a person declined storing the screening: the candidate is not moved",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: CANDIDATE_TYPE, id: SAMPLE_CANDIDATE_ID },
                    answer: answered({ record: SAMPLE_CANDIDATE }),
                },
                {
                    id: TOOL.recordGet,
                    args: { type: JOB_TYPE, id: SAMPLE_JOB_ID },
                    answer: answered({ record: SAMPLE_JOB }),
                },
                {
                    id: TOOL.recordUpdate,
                    args: {
                        type: CANDIDATE_TYPE,
                        id: SAMPLE_CANDIDATE_ID,
                        patch: {
                            stage: "screened",
                            screeningSummary: [
                                SAMPLE_SUMMARY,
                                ...SAMPLE_QUESTIONS.map((question) => `- ${question}`),
                            ].join("\n"),
                        },
                        version: "3",
                    },
                    answer: refused("declined"),
                },
            ],
            agent: [{ answer: { summary: SAMPLE_SUMMARY, questions: [...SAMPLE_QUESTIONS] } }],
            output: {
                name: HIRING_SAMPLE.candidateName,
                jobTitle: HIRING_SAMPLE.jobTitle,
                summary: SAMPLE_SUMMARY,
                questions: [...SAMPLE_QUESTIONS],
                declined: true,
            },
        },
        {
            name: "a candidate the store does not hold stops the step",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID },
            tools: [
                {
                    id: TOOL.recordGet,
                    args: { type: CANDIDATE_TYPE, id: SAMPLE_CANDIDATE_ID },
                    answer: refused("not_found"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.recordGet} refused: not_found` },
        },
    ],
})
