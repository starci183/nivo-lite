import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentThreadsLogEvent } from "../agent-threads.log-events"
import { ThreadResumeRequestsService } from "../thread-resume-requests.service"
import { RunStopRecordsService } from "./run-stop-records.service"
import type { RunStop } from "./run-stop.contracts"

/** The most open stops of a workspace, and of a person, read to find those a take-over left on a route. */
const OPEN_PAGE = 100

/** True for a stop a person took over on the route and still holds open (its last decision is the take-over). */
const takenOverOn = (stop: RunStop, routeId: string): boolean =>
    stop.state === "open" && stop.conversationId === routeId && stop.decision?.kind === "take_over"

/** The stops once each (a stop read by the person and by the workspace's open page is read twice), in the order first read. */
const distinctOf = (stops: ReadonlyArray<RunStop>): ReadonlyArray<RunStop> => stops.filter((stop, at) => stops.findIndex((one) => one.id === stop.id) === at)

@Injectable()
/**
 * The END of a take-over when a person hands the route back to the agents (owner ruling R51 item 3): every stop a person took over on the
 * route (open, its last decision `take_over`) is closed by the thread's own ending decision (`skip`, as the person who hands back), admitted
 * through the ONE resume door in the caller's transaction. The drain then applies it under the run's lease: the stop resolves (its card
 * offers no hand-back any more), the run that waited at the gate ends, and the freeze that stop caused releases with its held events
 * replayed once (`LeadFreezeStopHoldsService.threadSettled`), so the hand-back's resume event, delivered in the same transaction, starts
 * the agent's next turn and nothing waits behind a stop nobody can answer. Generic: a route and a stop, nothing of any chat.
 */
export class StopHandBackService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly records: RunStopRecordsService,
        private readonly threads: ThreadResumeRequestsService,
    ) {}

    /**
     * Ends every take-over left open on the route, as the member who hands it back, in the caller's transaction: answers how many stops'
     * ending decisions were admitted. A stop whose decision is refused (its thread no longer waits, another decision came first) is logged
     * by the resume door and not counted.
     */
    async handedBack(tx: EntityManager, workspaceId: string, routeId: string, contactId: string | null, memberId: string): Promise<number> {
        const [ofPerson, ofWorkspace] = await Promise.all([
            contactId === null ? Promise.resolve([]) : this.records.ofContacts(workspaceId, [contactId], "open", OPEN_PAGE),
            this.records.newest(workspaceId, "open", OPEN_PAGE),
        ])
        const taken = distinctOf([...ofPerson, ...ofWorkspace]).filter((stop) => takenOverOn(stop, routeId))
        const at = this.clock.now().toISOString()
        let ended = 0
        await eachInOrder(taken, async (stop) => {
            const admitted = await this.threads.resume(
                { workspaceId, runId: stop.runId, stepKey: stop.stepKey },
                { kind: "skip", by: memberId, at },
                tx,
            )
            if (admitted.kind === "admitted") ended += 1
        })
        if (taken.length > 0) this.logger.info(AgentThreadsLogEvent.TakeOverHandedBack, { workspaceId, routeId, stops: taken.length, ended })
        return ended
    }
}
