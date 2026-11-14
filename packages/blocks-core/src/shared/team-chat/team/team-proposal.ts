import { z } from "zod"
import type { NodeSchema } from "../../nodes/node-schema.types"

/**
 * A truth-graph change an answer turn proposes, as the turn writes it: what changes and why, in the asker's own words. The room and the
 * message it was said in are NOT part of it: `team.truth-propose` takes them from the turn's input, so a model never types an id. One
 * shape for every answer turn that may propose (`team.chat` and the four plugin `<module>.team-answer` turns).
 */
export interface TeamProposal {
    /** What the truth is about. */
    readonly subject: string
    /** Which property of the subject. */
    readonly attribute: string
    /** The new value; absent when the truth is retired. */
    readonly value?: string | undefined
    /** The unit of the value. */
    readonly unit?: string | undefined
    /** True to retire the truth. */
    readonly retire?: boolean | undefined
    /** The words that were said, verbatim. */
    readonly quote: string
    /** Why the truth changes, in the agent's own plain words: who said what, which value in force it replaces, for how long. */
    readonly reason: string
    /** When the change starts to hold. */
    readonly validFrom?: string | undefined
    /** When the change stops holding. */
    readonly validTo?: string | undefined
}

/** The schema of a proposal; its bounds are those of `nivo.tool.brain.change.propose` today (ASSUMPTIONS-A, T6). */
export const teamProposalSchema: NodeSchema<TeamProposal> = z.object({
    subject: z.string().min(1).max(160),
    attribute: z.string().min(1).max(120),
    value: z.string().min(1).max(500).optional(),
    unit: z.string().min(1).max(20).optional(),
    retire: z.boolean().optional(),
    quote: z.string().min(1).max(500).describe("The person's words, verbatim"),
    reason: z
        .string()
        .min(1)
        .max(1000)
        .describe("Who said what, which value in use it replaces, from when or for how long"),
    validFrom: z.string().max(40).optional(),
    validTo: z.string().max(40).optional(),
})
