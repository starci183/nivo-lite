import { backgroundStoppedKind } from "@nivo-lite/agent-sdk/team-chat"
import { parseJsonText } from "@modules/platform/primitives"
import type {
    BackgroundStoppedPayload,
    BackgroundStopReport,
    BackgroundTarget,
    BackgroundWork,
    OptionalBackgroundStoppedCardView,
    OptionalBackgroundStoppedPayload,
    StoredAgentMessage,
} from "./background-stop-card.contracts"
import { backgroundStoppedPayload } from "./background-stop-card.schema"
import type { TeamCardMessage } from "./team-chat-audience.contracts"
import { lineClientIdOf } from "./team-chat.policy"

/** The kind of NIVO's "background work stopped" card. */
export const BACKGROUND_STOPPED_MESSAGE_KIND: typeof backgroundStoppedKind.id = backgroundStoppedKind.id

/** Where the founder retries each background work. */
const TARGET_OF_WORK: Readonly<Record<BackgroundWork, BackgroundTarget>> = {
    "brain.policies.derive": "brain.policies",
    "brain.documents.truths": "brain.documents",
    "brain.vectors.sync": "brain.documents",
}

/** The client id of the ONE card of a failure episode of a work: every retry of the same episode names the same line. */
export const backgroundStoppedKeyOf = (work: BackgroundWork, episode: Date): string =>
    lineClientIdOf(`bg-stopped:${work}:${String(episode.getTime())}`)

/** The payload of the card of a report, stopped at `now`. */
export const backgroundStoppedPayloadOf = (report: BackgroundStopReport, now: Date): BackgroundStoppedPayload => ({
    version: 1,
    work: report.work,
    reason: report.reason,
    since: now.toISOString(),
    episode: report.episode.toISOString(),
    target: { kind: TARGET_OF_WORK[report.work] },
})

/**
 * The message of the card: it only tells (no one-tap reply; the retry is the target's own door). Title and line are the codes, never
 * words: the web words the card from its payload; the line is what a screen that draws no card shows.
 */
export const backgroundStoppedMessageOf = (payload: BackgroundStoppedPayload): TeamCardMessage => ({
    kind: BACKGROUND_STOPPED_MESSAGE_KIND,
    intent: "notify",
    title: payload.work,
    summary: `${payload.work} · ${payload.reason}`,
    payload,
    options: [],
})

/** The payload of a stored `background.stopped` card, or null when the line is no such card or does not read. */
export const storedBackgroundStoppedOf = (agentMessage: StoredAgentMessage): OptionalBackgroundStoppedPayload => {
    if (agentMessage === null) return null
    const read = parseJsonText(agentMessage)
    if (!read.ok || typeof read.value !== "object" || read.value === null) return null
    if (Reflect.get(read.value, "kind") !== BACKGROUND_STOPPED_MESSAGE_KIND) return null
    const parsed = backgroundStoppedPayload.safeParse(Reflect.get(read.value, "payload"))
    return parsed.success ? parsed.data : null
}

/** A `background.stopped` card as a screen reads it, or null when the line is no such card. */
export const backgroundStoppedCardViewOf = (agentMessage: StoredAgentMessage): OptionalBackgroundStoppedCardView => {
    const payload = storedBackgroundStoppedOf(agentMessage)
    if (payload === null) return null
    const { version: _shape, ...shown } = payload
    return shown
}
