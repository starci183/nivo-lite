import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { BODY_MAX, TEXT_KIND } from "./books-shapes"

/*
 * The one team post of the Accounting steps that tell the team. The agent WRITES the line (title, text) and the
 * node makes its one write (ADDENDUM 1): `TOOL.teamMessagePost` of a plain text message. The `kind` / `intent` members are the
 * node's, never a sentence of a goal.
 */

/** The intent of a team line: a notice about one record, or the report of a round. */
export type TeamLineIntent = "notify" | "report"

/** What the agent writes for the team. */
export interface TeamLine {
    /** A short title. */
    readonly title: string
    /** The message, in the team's language. */
    readonly text: string
}

/** The schema of a team line the agent writes. */
export const teamLineSchema: z.ZodType<TeamLine> = z.object({
    title: z.string().min(1).max(120).describe("A short title for the team, in the team's language."),
    text: z.string().min(1).max(BODY_MAX).describe("The message for the team, in the team's language."),
})

/** The args of the post a team line becomes (also what an example asserts). */
export const teamPostArgsOf = (intent: TeamLineIntent, line: TeamLine): Readonly<Record<string, string>> => ({
    kind: TEXT_KIND,
    intent,
    title: line.title,
    text: line.text,
})

/** What a team post became: `declined` true when a person declined the post on its card (a decision, never a failure). */
export interface TeamLinePosted {
    /** True when a person declined the line's approval, so it was not posted. */
    readonly declined: boolean
}

/**
 * Posts the line. A person declining the post is a decision the caller returns as its own declined form (the declined write is
 * itself a team post, so its graph ends `declined` with no notice); a refusal of the post is a fact: the node cannot go on
 * (`ctx.fail`), and the engine reports it; a side node's failure does not stop the run.
 */
export const postTeamLine = async (ctx: NodeContext, intent: TeamLineIntent, line: TeamLine): Promise<TeamLinePosted> => {
    const posted = await ctx.tools.call(TOOL.teamMessagePost, teamPostArgsOf(intent, line))
    if (!posted.ok && posted.declined === true) return { declined: true }
    if (!posted.ok) return ctx.fail({ kind: "cannot", why: `team_post_refused:${posted.refusal}` }, posted.facts)
    return { declined: false }
}
