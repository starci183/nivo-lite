import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_ID } from "../../bounds"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"
import { answered, refused } from "../tool-answers"
import { INVITE_GOAL } from "./hiring.policy"
import { readCandidate, readJob, CANDIDATE_TYPE, JOB_TYPE } from "./hiring.reads"
import {
    HIRING_SAMPLE,
    SAMPLE_CANDIDATE,
    SAMPLE_CANDIDATE_ID,
    SAMPLE_CANDIDATE_PHONE,
    SAMPLE_JOB,
    SAMPLE_JOB_ID,
    SAMPLE_SUMMARY,
} from "./hiring.samples"

type NoParams = Record<string, never>

/** Which candidate to invite, with the screening's summary. */
export interface InviteInput {
    /** The `blocks-core.hiring.candidate` record. */
    readonly candidateId: string
    /** The screening's summary. */
    readonly summary: string
}

/** What became of the invitation. */
export interface InviteOutput {
    /** True once the invitation was mailed (a person approved it on its card): `hiring.invite-move` moves the candidate next. */
    readonly mailed: boolean
    /** The mail's id, when the send answered one. */
    readonly messageRef: string | null
    /** Why nothing went: the send's refusal, or `no_mail_address`; null when mailed or declined. */
    readonly refusal: string | null
    /** True when a person declined the invitation on its card: nothing was mailed (the graph tells the team, ends `declined`). */
    readonly declined: boolean
}

/** The mail the agent writes (a type, so an example's answer holds it as JSON). */
type InviteMail = {
    readonly to: string
    readonly subject: string
    readonly body: string
}

/** What the agent answers: the mail, or null when the candidate has no e-mail address. */
interface InviteAnswer {
    readonly mail: InviteMail | null
}

const SUBJECT_MAX = 200
const ADDRESS_MAX = 320

const params: NodeSchema<NoParams> = z.strictObject({})
const input: NodeSchema<InviteInput> = z.object({
    candidateId: z.string().min(1).max(MAX_ID),
    summary: z.string().max(MAX_BODY),
})
const output: NodeSchema<InviteOutput> = z.object({
    mailed: z.boolean().describe("True once the invitation was mailed."),
    messageRef: z.string().max(MAX_ID).nullable(),
    refusal: z.string().max(MAX_ID).nullable().describe("The send's refusal, or `no_mail_address`; null when mailed or declined."),
    declined: z.boolean().describe("True when a person declined the invitation on its card: nothing was mailed."),
})
const answer: NodeSchema<InviteAnswer> = z.object({
    mail: z
        .object({
            to: z
                .string()
                .min(3)
                .max(ADDRESS_MAX)
                .describe("The candidate's e-mail address, exactly as `contact` holds it"),
            subject: z.string().min(1).max(SUBJECT_MAX).describe("The subject, in Vietnamese"),
            body: z.string().min(1).max(MAX_BODY).describe("The plain invitation, in Vietnamese"),
        })
        .nullable()
        .describe("null when `contact` holds no e-mail address"),
})

/** The invitation of the examples. */
const MAIL: InviteMail = {
    to: "minhanh@example.com",
    subject: HIRING_SAMPLE.inviteSubject,
    body: HIRING_SAMPLE.inviteBody,
}

/** The args of the send: the mail and the candidate it is about. */
const mailArgs = (mail: InviteMail, candidateId: string): JsonObject => ({
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    ref: { kind: "candidate", code: candidateId },
})

/** The candidate read of the examples. */
const candidateRead = (candidate: JsonObject) => ({
    id: TOOL.recordGet,
    args: { type: CANDIDATE_TYPE, id: SAMPLE_CANDIDATE_ID },
    answer: answered({ record: candidate }),
})

/** The job read of the examples. */
const JOB_READ = {
    id: TOOL.recordGet,
    args: { type: JOB_TYPE, id: SAMPLE_JOB_ID },
    answer: answered({ record: SAMPLE_JOB }),
}

/**
 * `hiring.invite` (invite to an interview): the agent writes the interview invitation to the candidate's own e-mail address; the step
 * mails it with `TOOL.mailMessageSend` (provider `smtp`, mode `ask`: a person approves, edits and sends it), its ONE write (rights rule
 * 11e); moving the candidate to `interview` is the next step (`hiring.invite-move`). A candidate with no e-mail address gets no mail
 * (`no_mail_address`): the team reaches them another way. A person who declines the invitation on its card made a decision
 * (`declined`, never a failure). A side step (`blocking: false`): without a sending mailbox the screening still stands; any other
 * refusal of the send is said in the output (`refusal`) and nobody is moved.
 */
export const hiringInviteNode: TemplateNode<
    NodeSchema<InviteInput>,
    NodeSchema<InviteOutput>,
    NodeSchema<NoParams>
> = defineTemplateNode({
    id: "hiring.invite",
    title: bilingualOf("nodeHiringInviteTitle"),
    description: { vi: "So\u1ea1n th\u01b0 m\u1eddi ph\u1ecfng v\u1ea5n g\u1eedi t\u1edbi email c\u1ee7a \u1ee9ng vi\u00ean; sau khi b\u1ea1n duy\u1ec7t v\u00e0 g\u1eedi th\u00ec chuy\u1ec3n \u1ee9ng vi\u00ean sang b\u01b0\u1edbc ph\u1ecfng v\u1ea5n.", en: "Writes the interview invitation to the candidate's email; once you approve and send it, moves the candidate to the interview stage." },
    tools: [TOOL.mailMessageSend],
    mode: "ask",
    accounts: [PROVIDER.smtp],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    blocking: false,
    run: async (given, context) => {
        const candidate = await readCandidate(context, given.candidateId)
        const job = await readJob(context, candidate.jobId)
        const written = await context.agent.run({
            goal: INVITE_GOAL,
            input: {
                job: { title: job.title, description: job.description },
                candidate: { name: candidate.name, contact: candidate.contact },
                summary: given.summary,
            },
            output: answer,
            tools: [],
            maxTurns: 1,
        })
        if (written.mail === null) return { mailed: false, messageRef: null, refusal: "no_mail_address", declined: false }
        const sent = await context.tools.call(TOOL.mailMessageSend, mailArgs(written.mail, candidate.id))
        if (!sent.ok && sent.declined === true) return { mailed: false, messageRef: null, refusal: null, declined: true }
        if (!sent.ok) return { mailed: false, messageRef: null, refusal: sent.refusal, declined: false }
        const emailMessageId = sent.value["emailMessageId"]
        return { mailed: true, messageRef: typeof emailMessageId === "string" ? emailMessageId : null, refusal: null, declined: false }
    },
    examples: [
        {
            name: "mails the invitation a person approved",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID, summary: SAMPLE_SUMMARY },
            tools: [
                candidateRead(SAMPLE_CANDIDATE),
                JOB_READ,
                {
                    id: TOOL.mailMessageSend,
                    args: mailArgs(MAIL, SAMPLE_CANDIDATE_ID),
                    answer: answered({ emailMessageId: "wi-7", status: "sent" }),
                },
            ],
            agent: [{ answer: { mail: MAIL } }],
            output: { mailed: true, messageRef: "wi-7", refusal: null, declined: false },
        },
        {
            name: "a person declined the invitation on its card: a decision, nothing mailed",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID, summary: SAMPLE_SUMMARY },
            tools: [
                candidateRead(SAMPLE_CANDIDATE),
                JOB_READ,
                { id: TOOL.mailMessageSend, args: mailArgs(MAIL, SAMPLE_CANDIDATE_ID), answer: refused("declined") },
            ],
            agent: [{ answer: { mail: MAIL } }],
            output: { mailed: false, messageRef: null, refusal: null, declined: true },
        },
        {
            name: "the mailbox refused the send: the refusal is said, nothing mailed, nobody moved",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID, summary: SAMPLE_SUMMARY },
            tools: [
                candidateRead(SAMPLE_CANDIDATE),
                JOB_READ,
                { id: TOOL.mailMessageSend, args: mailArgs(MAIL, SAMPLE_CANDIDATE_ID), answer: refused("mailbox_unavailable") },
            ],
            agent: [{ answer: { mail: MAIL } }],
            output: { mailed: false, messageRef: null, refusal: "mailbox_unavailable", declined: false },
        },
        {
            name: "a candidate reached by phone only gets no mail",
            params: {},
            input: { candidateId: SAMPLE_CANDIDATE_ID, summary: SAMPLE_SUMMARY },
            tools: [candidateRead(SAMPLE_CANDIDATE_PHONE), JOB_READ],
            agent: [{ answer: { mail: null } }],
            output: { mailed: false, messageRef: null, refusal: "no_mail_address", declined: false },
        },
    ],
})
