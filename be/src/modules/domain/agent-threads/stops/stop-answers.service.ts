import { Injectable, Optional } from "@nestjs/common"
import type { FilterExpr, OrderBy } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { lineKeyOf, TeamChatRoomsService } from "@modules/domain/team-chat"
import type { AgentLineReplied } from "@modules/domain/team-chat"
import { DomainError } from "@modules/platform/errors"
import { runStopOf } from "./run-stop-records.service"
import type { RunStop, StopState } from "./run-stop.contracts"
import { stopCardKeyOf } from "./stop-cards.service"
import { StopDoorService } from "./stop-door.service"
import type { StopDoorOutcome } from "./stop-door.service"

const STOP = "agent.run-stop"

/** Binds the cursor of the lists of this reader: none is paged past one bounded page. */
const LIST_SCOPE = "run-stop-answers"

/** The most stops of one state of a workspace a reply is matched against: the newest, by the index `state_stopped`. */
const STOPS_LOOKED = 50

const SELECT: ReadonlyArray<string> = [
    "runId",
    "stepKey",
    "agentId",
    "workflowId",
    "leadId",
    "conversationId",
    "kind",
    "state",
    "reason",
    "question",
    "detail",
    "cardMessageId",
    "customerLines",
    "answers",
    "decision",
    "repeats",
    "stoppedAt",
    "resolvedAt",
]

const NEWEST: OrderBy = [
    ["stoppedAt", "desc"],
    ["id", "desc"],
]

const stateIs = (state: StopState): FilterExpr => ({ op: "eq", field: "state", value: state })

/**
 * A person's reply to an engine line in the team chat. The words and their time travel with it once the team chat hands them
 * (requested of the team chat's owner); until then the newest reply under the card is read.
 */
export interface StopReply extends AgentLineReplied {
    /** The words of the reply, when the team chat hands them. */
    readonly text?: string | undefined
    /** When the reply was written, ISO, when the team chat hands it. */
    readonly at?: string | undefined
}

/** How a reply to the card of a stop ended: the door's outcome, or `not_allowed` for a person who may not decide for the workspace. */
export type StopReplyOutcome = StopDoorOutcome | "not_allowed"

/** A reply that was to the card of a stop: which run and step, and how it ended. */
export interface StopReplied {
    /** The run. */
    readonly runId: string
    /** The step of the stop. */
    readonly stepKey: string
    /** How it ended. */
    readonly outcome: StopReplyOutcome
}

/** The stop whose card a reply answers, among the stops read: the card's key is the stop's run and step. */
export const stopOfLine = (stops: ReadonlyArray<RunStop>, lineKey: string): RunStop | null =>
    stops.find((stop) => lineKeyOf(stopCardKeyOf(stop.runId, stop.stepKey)) === lineKey) ?? null

@Injectable()
/**
 * The founder's words in the team chat: a reply to the card of a stop is the answer the stopped step waits for. The reply is matched to
 * the stop whose card it answers (the card's key is the stop's run and step), and handed to the stop door as an `answer` with the words
 * and the moment of the reply, as the person who wrote it: who may answer, the wake and the step's next run all go as from the card's
 * box. A reply to the card of a stop already resolved is told `stop_closed` and moves nothing. A reply to any other line is not this
 * reader's: it answers null, and the freezes of the old engine take it.
 */
export class StopAnswersService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly door: StopDoorService,
        @Optional() private readonly chat?: TeamChatRoomsService,
    ) {}

    /** Hands the words of a reply to the stop whose card it answers; null when it answers the card of no stop. */
    async replied(reply: StopReply): Promise<StopReplied | null> {
        const stop =
            stopOfLine(await this.newest(reply.workspaceId, "open"), reply.lineKey) ??
            stopOfLine(await this.newest(reply.workspaceId, "resolved"), reply.lineKey)
        if (stop === null) return null
        const replied = (outcome: StopReplyOutcome): StopReplied => ({ runId: stop.runId, stepKey: stop.stepKey, outcome })
        if (stop.state === "resolved") return replied("stop_closed")
        const words = await this.wordsOf(reply, stop)
        if (words === null) return replied("invalid")
        try {
            const answered = await this.door.decide(reply.byUserId, {
                workspaceId: reply.workspaceId,
                runId: stop.runId,
                stepKey: stop.stepKey,
                action: "answer",
                text: words.text,
                at: words.at,
            })
            return replied(answered.outcome)
        } catch (cause) {
            // A person who may not decide for the workspace: their reply stays a message, the stop stays as it is.
            if (cause instanceof DomainError) return replied("not_allowed")
            throw cause
        }
    }

    /** The words of the reply and their moment: as the team chat handed them, else the newest reply under the stop's card. */
    private async wordsOf(reply: StopReply, stop: RunStop): Promise<{ readonly text: string; readonly at: string } | null> {
        if (reply.text !== undefined && reply.text.trim() !== "" && reply.at !== undefined)
            return { text: reply.text, at: reply.at }
        const replies = (await this.chat?.repliesToAgentLine(reply.workspaceId, stopCardKeyOf(stop.runId, stop.stepKey))) ?? []
        const newest = replies.at(-1)
        return newest === undefined || newest.text.trim() === "" ? null : { text: newest.text, at: newest.at }
    }

    /** The newest stops of a state of the workspace, by the entity's index on state and moment. */
    private newest(workspaceId: string, state: StopState): Promise<ReadonlyArray<RunStop>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const page = await this.engine.list(
                tx,
                { from: STOP, select: SELECT, where: stateIs(state), order: NEWEST, page: { size: STOPS_LOOKED } },
                LIST_SCOPE,
            )
            return page.rows.map((listed) => runStopOf(listed.row))
        })
    }
}
