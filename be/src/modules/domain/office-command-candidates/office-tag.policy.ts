import type { AgentHandleCard } from "@modules/domain/agents"
import type { TagLineKey, OfficeTranscriptLine } from "./office-command-candidates.contracts"

/** The most agents one line may tag: a longer list is cut, in the order the author wrote it. */
export const MAX_TAGS = 3

/** How many earlier lines of the room or thread a tagged agent reads. */
export const TRANSCRIPT_SIZE = 12

/** The marker in front of the line that tagged the agent, so it is told apart from the lines before it. */
const TAGGED_MARK = "->"

/** The agents a line tags: the handles in the order written, those nobody holds dropped, at most {@link MAX_TAGS}. */
export const taggedAgentsOf = (
    handles: ReadonlyArray<string>,
    agents: ReadonlyArray<AgentHandleCard>,
): Array<AgentHandleCard> => {
    const byHandle = new Map(agents.map((agent) => [agent.handle, agent] as const))
    return handles.flatMap((handle) => byHandle.get(handle) ?? []).slice(0, MAX_TAGS)
}

/**
 * The words of a tag wake: the lines said before, oldest first, then the line that tagged the agent, marked. Only people's and agents'
 * lines are kept, NIVO's own notes are not part of the talk. The caller labels the whole text as data.
 */
export const transcriptOf = (before: ReadonlyArray<OfficeTranscriptLine>, tagged: OfficeTranscriptLine): string =>
    [...before.filter((line) => line.id !== tagged.id).slice(-TRANSCRIPT_SIZE), tagged]
        .map((line) => [line.id === tagged.id ? `${TAGGED_MARK} ` : "", line.author, ": ", line.body].join(""))
        .join("\n")

/** The catalog key of the line that answers a tag the agent could not take, by why it could not. */
export const holdLineKeyOf = (reason: string): TagLineKey => {
    if (reason === "quota") return "office.tagQuota"
    if (reason === "killed") return "office.tagWorkOff"
    if (reason === "breaker" || reason === "daily_cap" || reason === "openclaw_not_configured") return "office.tagBusy"
    return "office.tagFailed"
}

/** Whether a hold-over reason is a wake that waits for work to be switched back on, which the drain holds rather than skips. */
export const isHeldReason = (reason: string): boolean => reason === "killed"
