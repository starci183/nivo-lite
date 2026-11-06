import { Injectable } from "@nestjs/common"
import { ChatProfilesService } from "@modules/domain/chat-records"
import type { ChatProfileCandidate } from "@modules/domain/chat-records"
import { PollLimiterService } from "@modules/domain/connection-poll"
import { ConnectionsService } from "@modules/domain/connections"
import type { HealthCandidate } from "@modules/domain/connections"
import { EngineDoorService } from "@modules/domain/entity-engine-door"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { isZaloInboxPollPayload } from "@modules/queues/zalo-inbox-poll"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"
import { PROFILE_BATCH, profileCuts, profileOfAnswer } from "./zalo-profile.policy"
import { ZaloProviderLogEvent } from "./zalo-provider.log-events"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

/** The customers a round read and the ones it could not. */
export interface ZaloProfileTally {
    /** Customers whose profile was read and kept. */
    readonly read: number
    /** Customers whose read failed: they keep their name and wait for the next round. */
    readonly failed: number
}

/** How one customer's read ended: kept, failed (tried again later), or the round must stop here. */
type ReadEnd = "read" | "failed" | "stopped"

/** The connection a round reads customers of. */
interface ProfileRound {
    readonly workspaceId: string
    readonly connectionId: string
}

const NONE: ZaloProfileTally = { read: 0, failed: 0 }

const plus = (left: ZaloProfileTally, right: ZaloProfileTally): ZaloProfileTally => ({
    read: left.read + right.read,
    failed: left.failed + right.failed,
})

@Injectable()
/**
 * Gives the customers of the Zalo conversations their name and picture: a customer whose profile was never read, or was read long ago, is asked
 * about through the NIVO MCP door (`chat.profile`, so the grant of the internal agent decides it and the call log records it), and the answer is
 * kept on the conversation. Each connection reads at most a few customers a round, one call per customer id and through the connection's own
 * rate bucket. A failed read is data: the conversation keeps the name it has ("Zalo guest" until one is read) and is tried again after a pause.
 */
export class ZaloProfileService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly profiles: ChatProfilesService,
        private readonly door: EngineDoorService,
        private readonly limiter: PollLimiterService,
        private readonly poller: ZaloInboxPollerService,
    ) {}

    /**
     * Runs the round a reconcile job asks for: one connection when the payload names it, else every Zalo connection. A payload that is not a
     * reconcile payload reads nobody. A round that fails as a whole (the database, not one customer) is logged and read as nothing done: the
     * job it rides on has already stored its messages.
     */
    async refreshFromJob(payload: unknown): Promise<ZaloProfileTally> {
        if (!isZaloInboxPollPayload(payload)) return NONE
        try {
            const tally =
                payload.connectionId === undefined || payload.workspaceId === undefined
                    ? await this.scan("", NONE)
                    : await this.roundOf({ workspaceId: payload.workspaceId, connectionId: payload.connectionId })
            this.logger.info(ZaloProviderLogEvent.ProfilesDone, { ...tally })
            return tally
        } catch (cause) {
            this.logger.error(ZaloProviderLogEvent.ProfileRoundStopped, cause, {})
            return NONE
        }
    }

    private async scan(afterId: string, tally: ZaloProfileTally): Promise<ZaloProfileTally> {
        const batch = await this.connections.healthBatch(afterId, SCAN_PAGE)
        const last = batch.at(-1)
        if (last === undefined) return tally
        const counts: Array<ZaloProfileTally> = []
        await eachInOrder(
            batch.filter((candidate) => this.readsProfiles(candidate)),
            async (candidate) => {
                counts.push(await this.roundOf({ workspaceId: candidate.workspaceId, connectionId: candidate.id }))
            },
        )
        const next = counts.reduce(plus, tally)
        return batch.length === SCAN_PAGE ? this.scan(last.id, next) : next
    }

    private readsProfiles(candidate: HealthCandidate): boolean {
        return candidate.provider === this.poller.provider && candidate.status !== "disconnected"
    }

    /** One connection's round: the customers it owes, read one after the other. */
    private async roundOf(round: ProfileRound): Promise<ZaloProfileTally> {
        const due = await this.profiles.due(round.workspaceId, {
            connectionId: round.connectionId,
            ...profileCuts(this.clock.now()),
            limit: PROFILE_BATCH,
        })
        return this.readEach(round, due, NONE)
    }

    private async readEach(
        round: ProfileRound,
        candidates: ReadonlyArray<ChatProfileCandidate>,
        tally: ZaloProfileTally,
    ): Promise<ZaloProfileTally> {
        const [next, ...rest] = candidates
        if (next === undefined) return tally
        const end = await this.readOne(round, next)
        if (end === "stopped") return tally
        return this.readEach(
            round,
            rest,
            plus(tally, { read: end === "read" ? 1 : 0, failed: end === "failed" ? 1 : 0 }),
        )
    }

    /** Asks the door for one customer's profile and keeps the answer; a refusal or an unreadable answer keeps only the try. A rate limit or a missing door agent stops the round. */
    private async readOne(round: ProfileRound, candidate: ChatProfileCandidate): Promise<ReadEnd> {
        const { workspaceId, connectionId } = round
        try {
            await this.limiter.pass(this.poller.provider, connectionId, this.poller.limits)
            const door = this.door.doorApi({
                workspaceId,
                effectKey: (step) => `zalo-profile:${candidate.id}:${step}`,
                scopeOpen: () => false,
            })
            const answered = await door.call("chat.profile", { conversationId: candidate.id })
            const profile = answered.ok ? profileOfAnswer(answered.output) : null
            if (profile === null) {
                await this.profiles.tried(workspaceId, candidate.id, this.clock.now())
                this.logger.warn(ZaloProviderLogEvent.ProfileFailed, {
                    conversationId: candidate.id,
                    reason: answered.ok ? "unreadable_answer" : answered.reason,
                })
                return "failed"
            }
            await this.profiles.record(workspaceId, candidate.id, profile, this.clock.now())
            return "read"
        } catch (cause) {
            this.logger.error(ZaloProviderLogEvent.ProfileRoundStopped, cause, { connectionId })
            return "stopped"
        }
    }
}
