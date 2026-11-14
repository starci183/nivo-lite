import { TOOL } from "./tool"

/** The Brain's tools as one name (`nivo.tool.brain.*`), built from the search's id so a rename of the level reaches the model's words. */
const BRAIN_TOOLS = `${TOOL.brainSearch.split(".").slice(0, 3).join(".")}.*`

/**
 * How to read a truth a Brain read serves (owner order 2026-11-11, item 2: compact names an agent cites and doubts by). ONE text for
 * both readers of the tools: the step's model (blocks-core's tool words, `modelWordsOf`) and the gateway's tool descriptions (the be
 * Brain tools `nivo.tool.brain.*` import it), so the two cannot drift. Written once, on the truth search; the other truth reads point at it.
 */
export const BRAIN_FACT_LEGEND: string =
    `Each fact (here and in every ${BRAIN_TOOLS} read): num = the number the store read from the value (a price "55.000 d" is 55000), null when the value is not one; src = who said it (kind, label, at), v = version, from/to = validity, now = in|later|ended, pub = customers may know it, disputed = other values of the same truth (now in = also in force, wait = waiting for the founder), next = the value approved to take over and from when. degraded = meaning_unavailable: matched by words only.`

/** What the other truth reads say instead of the legend: their facts read the same way. */
export const BRAIN_FACT_FIELDS_POINTER: string = `Fact fields as in ${TOOL.brainSearch}.`

/** The words a model reads after a tool's own words, by the tool's text key: the legend on the search, the pointer on the other reads. */
export const BRAIN_FACT_MODEL_NOTES: Readonly<Record<string, string>> = {
    toolBrainSearch: BRAIN_FACT_LEGEND,
    toolBrainFactGet: BRAIN_FACT_FIELDS_POINTER,
    toolBrainFactRelated: BRAIN_FACT_FIELDS_POINTER,
}
