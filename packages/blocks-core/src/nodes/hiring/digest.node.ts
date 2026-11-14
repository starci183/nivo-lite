import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_LINE } from "../../bounds"
import { OPEN_CANDIDATE_STAGES } from "../../entities/hiring/candidate.entity"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, valueOrCannot } from "../tool-answers"
import { DIGEST_GOAL } from "./hiring.policy"
import { candidateOf, jobOf, recordsOf, CANDIDATE_TYPE, JOB_TYPE } from "./hiring.reads"
import { HIRING_SAMPLE, SAMPLE_CANDIDATE, SAMPLE_JOB } from "./hiring.samples"

type NoParams = Record<string, never>

/** What wakes the digest: the clock's slot, which the digest does not read. */
export interface DigestInput {
    /** The clock's slot (epoch milliseconds), or null on a person's "run now". */
    readonly slotMs?: number | null | undefined
}

/** The digest the team reads, or no line when nothing is open. */
export interface DigestOutput {
    /** True when something is open and a line was written. */
    readonly open: boolean
    /** The heading. */
    readonly title: string
    /** The words. */
    readonly text: string
}

/** What the agent answers. */
interface DigestAnswer {
    readonly title: string
    readonly text: string
}

/** The most records of each type the digest reads (the record list's cap). */
const PAGE = 50

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<DigestInput> = z.object({ slotMs: z.number().int().positive().nullish() })
const output: NodeSchema<DigestOutput> = z.object({
    open: z.boolean(),
    title: z.string().max(MAX_LINE),
    text: z.string().max(MAX_BODY),
})
const answer: NodeSchema<DigestAnswer> = z.object({
    title: z.string().min(1).max(MAX_LINE).describe("A short heading in Vietnamese"),
    text: z.string().min(1).max(MAX_BODY).describe("The digest in Vietnamese, at most 10 lines"),
})

const DIGEST_TITLE = HIRING_SAMPLE.digestTitle
const DIGEST_TEXT = HIRING_SAMPLE.digestText

/** The list call of one record type. */
const listArgs = (type: string): Readonly<Record<string, string | number>> => ({ type, limit: PAGE })

/**
 * `hiring.digest` (the morning hiring digest): lists the jobs and the candidates (one page each), keeps the open jobs and the
 * candidates still in progress (a comparison of the declared stage, not a reading of meaning), and the agent writes the team's
 * digest. With nothing open it writes no line (`open` false).
 */
export const hiringDigestNode: TemplateNode<
    NodeSchema<DigestInput>,
    NodeSchema<DigestOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "hiring.digest",
    title: bilingualOf("nodeHiringDigestTitle"),
    description: { vi: "M\u1ed7i s\u00e1ng vi\u1ebft b\u1ea3n t\u00f3m t\u1eaft tuy\u1ec3n d\u1ee5ng cho \u0111\u1ed9i: c\u00e1c v\u1ecb tr\u00ed \u0111ang m\u1edf v\u00e0 \u1ee9ng vi\u00ean \u0111ang trong qu\u00e1 tr\u00ecnh x\u00e9t.", en: "Each morning writes the team a hiring digest: the open jobs and the candidates in progress." },
    tools: [],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (_given, context) => {
        const jobsAnswer = await context.tools.call(TOOL.recordList, listArgs(JOB_TYPE))
        const candidatesAnswer = await context.tools.call(TOOL.recordList, listArgs(CANDIDATE_TYPE))
        const jobs = recordsOf(valueOrCannot(context, TOOL.recordList, jobsAnswer))
            .map((record) => jobOf(record))
            .filter((job) => job.status === "open")
        const candidates = recordsOf(valueOrCannot(context, TOOL.recordList, candidatesAnswer))
            .map((record) => candidateOf(record))
            .filter((candidate) => OPEN_CANDIDATE_STAGES.includes(candidate.stage))
        if (jobs.length === 0 && candidates.length === 0) return { open: false, title: "", text: "" }
        const written = await context.agent.run({
            goal: DIGEST_GOAL,
            input: {
                jobs: jobs.map((job) => ({ id: job.id, title: job.title })),
                candidates: candidates.map((candidate) => ({
                    name: candidate.name,
                    jobId: candidate.jobId,
                    stage: candidate.stage,
                    summary: candidate.screeningSummary,
                })),
            },
            output: answer,
            tools: [],
            maxTurns: 1,
        })
        return { open: true, title: written.title, text: written.text }
    },
    examples: [
        {
            name: "writes the digest of the open jobs and the candidates in progress",
            params: {},
            input: { slotMs: null },
            tools: [
                {
                    id: TOOL.recordList,
                    args: listArgs(JOB_TYPE),
                    answer: answered({ records: [SAMPLE_JOB], next: null }),
                },
                {
                    id: TOOL.recordList,
                    args: listArgs(CANDIDATE_TYPE),
                    answer: answered({ records: [SAMPLE_CANDIDATE], next: null }),
                },
            ],
            agent: [{ answer: { title: DIGEST_TITLE, text: DIGEST_TEXT } }],
            output: { open: true, title: DIGEST_TITLE, text: DIGEST_TEXT },
        },
        {
            name: "writes no line when nothing is open",
            params: {},
            input: { slotMs: null },
            tools: [
                { id: TOOL.recordList, args: listArgs(JOB_TYPE), answer: answered({ records: [], next: null }) },
                { id: TOOL.recordList, args: listArgs(CANDIDATE_TYPE), answer: answered({ records: [], next: null }) },
            ],
            output: { open: false, title: "", text: "" },
        },
    ],
})
