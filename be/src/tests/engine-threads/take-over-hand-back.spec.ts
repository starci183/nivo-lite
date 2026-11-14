import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { RunStopRecordsService, StopHandBackService, stopCardStateOf } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DoorPressesService } from "@modules/domain/agent-doors/door-presses.service"
import { HoldReleaseDoorService } from "@modules/domain/agent-doors/hold-release-door.service"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Logger } from "@modules/platform/logging"
import { holdProvidersOf } from "./thread-world-core"
import { chatServicesOf, transactionalManager } from "./thread-world-intake"
import { WS } from "./thread-world-records"
import { worldRunStopStore } from "./thread-world-tables"
import {
    ANSWER,
    CONTACT,
    CONV,
    CORE,
    UNDERSTAND,
    button,
    customerWrites,
    customersSay,
    drain,
    founderDecides,
    processOf,
    rowsOf,
    runTurns,
    stopsOf,
    threadDbOf,
    type ThreadDb,
    type ThreadProcess,
} from "./thread-world"

// OWNER RULING R51 ITEM 3, the whole road on the world (dev 2026-11-14, RESTART-R2: after a Take over, "Trả lại cho agent" cleared the
// route hold, but the resume event was held by the freeze the SAME stop caused, the run never resumed, and the stop stayed taken over so
// the card kept its hand-back button). The REAL hand-back door (`HoldReleaseDoorService.handAs`, what the GraphQL door and the
// `platform.route-holds` port run) over the REAL route store, the REAL stop records and resume door, the REAL release door
// (`HeldLinesService`: the one resume event through the REAL `deliver`), and the REAL freezes of the stops (`holdProvidersOf`).
//
// Why no test caught it: the door's own spec mocks the release door and counts its wakes as the answer (`answered: 1` is "released" though
// the wake is then held); the R45 hand-back worlds (`sale-edges.spec.ts`) hold the route over a sale PARKED AT A WAIT, never over a STOP a
// person took over, so no freeze stood between the resume event and the agent; and the take-over world (`take-over.spec.ts`) ends its
// take-over by a `skip` pressed on the card, never by a hand-back.

const QUESTION = "Shop mo cua may gio?"
const DURING = "Alo shop oi?"
const REPLY = "Shop mo cua tu 8h den 21h a."

/** The AI core's report of a step that cannot go on. */
const REPORT = { decision: "report", reason: "x", question: "Shop mo may gio?", suggestions: [{ text: "8h-21h", handledBy: "workflow" }], customerLine: null }

/** The answer step's send of the reply to the run's own conversation. */
const sends = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })

/** The REAL hand-back door of the app over the world's stores; only who may press it (the seat) and the press log are doubles. */
const handBackDoorOf = (db: ThreadDb, process: ThreadProcess): HoldReleaseDoorService => {
    const services = chatServicesOf(db)
    const takeOvers = new StopHandBackService(db.clock, mock<Logger>(), new RunStopRecordsService(worldRunStopStore(db.records)), process.requests)
    const seats = mock<MemberLookupService>({ activeSeatById: () => Promise.resolve({ displayName: "Owner Lan", isManager: true }) })
    return new HoldReleaseDoorService(
        transactionalManager(),
        mock<AgentWorkAccessService>(),
        mock<WorkspaceMembersService>(),
        mock<DoorPressesService>({ record: () => Promise.resolve(undefined) }),
        seats,
        services.routes,
        services.held,
        takeOvers,
    )
}

/** A front desk run stopped at `answer`, taken over by the owner (the stop door's two acts: the decision, and the route held as the owner). */
const takenOver = async () => {
    const db = threadDbOf()
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { confused: { reason: "Khong ro gio mo cua", question: "Shop mo may gio?" } })
    db.model.script(CORE, REPORT)
    const process = await processOf(db, { extra: holdProvidersOf(db) })
    const runId = (await customerWrites(process, QUESTION)).runId ?? ""
    await founderDecides(process, runId, button(db, "take_over"))
    await chatServicesOf(db).routes.hold(WS, CONV, "owner-1")
    return { db, process, runId }
}

describe("R51 item 3: 'hand back to the agent' ends the take-over completely", () => {
    it("clears the hold, closes the taken-over stop, lifts its freeze, and the ONE resume event makes the agent answer once", async () => {
        const { db, process, runId } = await takenOver()
        // A line during the hold is kept and wakes nothing (R45).
        await expect(customersSay(process, [{ text: DURING, key: "m-during" }])).resolves.toEqual([])
        const lines = db.lines.length
        const fromWakes = db.wakes.length
        const fromChat = db.chat.wakes.length

        await expect(handBackDoorOf(db, process).handAs(WS, "owner-1", CONV)).resolves.toMatchObject({ outcome: "released", answered: 1 })

        // ONE transaction wrote: the hold cleared, the taken-over stop's ending decision (the run's resume wake), the ONE resume event.
        await expect(chatServicesOf(db).routes.holdOf(WS, CONV)).resolves.toBeNull()
        const resumeEvents = db.chat.wakes.slice(fromChat)
        expect(resumeEvents).toHaveLength(1)
        expect(db.wakes.slice(fromWakes).map((wake) => wake.context.subjectId)).toEqual([runId])

        // The drain, in the order dev saw it: the resume event first. While the stop is still open its freeze holds the event (as on dev) ...
        const first = await runTurns(process, resumeEvents)
        expect(first.map((one) => one.ending?.status)).toEqual(["held"])
        // ... then the run's ending decision: the stop resolves (decided by the person who handed back), the run that waited at the gate ends.
        await expect(drain(process, fromWakes)).resolves.toEqual([expect.objectContaining({ error: null })])
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ state: "resolved", decision: { kind: "skip", by: "owner-1" } })
        // The card reads the stop as closed: no "taken over", nothing it still takes (no hand-back button: the card's own rule).
        expect(stop === undefined ? null : stopCardStateOf(stop)).toMatchObject({ takenOver: false, needs: { answer: false, decisions: [] } })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })

        // The freeze that stop caused is released (`stop_closed`) and the held resume event is written again ONCE (the only wake after the
        // ending decision): it starts the agent's next turn, which reads the thread and answers once.
        const [freeze] = db.records.of("contact_freezes").map((row) => row.data)
        expect(freeze).toMatchObject({ status: "released", releaseReason: "stop_closed", frozenRunId: runId, contactId: CONTACT })
        const replays = db.wakes.slice(fromWakes + 1)
        expect(replays.map((wake) => wake.context.eventId)).toEqual([resumeEvents[0]?.context.eventId])
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, sends(REPLY), { done: { reply: REPLY } })
        const replayed = await drain(process, fromWakes + 1)
        expect(replayed.map((one) => one.error)).toEqual([null])
        expect(db.lines.slice(lines).map((line) => line.text)).toEqual([REPLY])
        expect([...db.runs.keys()]).toHaveLength(2)
    })

    it("a second press before the drain applied the first writes no second ending decision (the resume door's once-key)", async () => {
        const { db, process, runId } = await takenOver()
        const door = handBackDoorOf(db, process)
        await door.handAs(WS, "owner-1", CONV)
        const fromWakes = db.wakes.length

        // The ending decision of the first press is not applied yet (the drain has not run): the stop is still open, its decision recorded.
        await door.handAs(WS, "owner-1", CONV)

        expect(db.wakes.slice(fromWakes).filter((wake) => wake.context.subjectId === runId)).toEqual([])
    })
})

// Ruling R52: ANY decision that closes a taken-over stop ends the hold that take-over set. Skip used to leave it (only Retry and words
// cleared it): the card then offered no Hand back and the held route swallowed every later line (a stuck customer).
describe("R52: a Skip on a taken-over stop ends the route's hold", () => {
    it("clears the hold with the Skip, closes the stop, and the customer's later line starts a run the agent answers", async () => {
        const { db, process, runId } = await takenOver()
        await expect(chatServicesOf(db).routes.holdOf(WS, CONV)).resolves.toMatchObject({ memberId: "owner-1" })

        const skipped = await founderDecides(process, runId, button(db, "skip"))

        expect(skipped.map((one) => one.error)).toEqual([null])
        await expect(chatServicesOf(db).routes.holdOf(WS, CONV)).resolves.toBeNull()
        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ state: "resolved", decision: { kind: "skip" } })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        // Whatever the stop's freeze replays on its release is drained first.
        await drain(process, db.wakes.length)

        const lines = db.lines.length
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, sends(REPLY), { done: { reply: REPLY } })
        const later = await customerWrites(process, DURING)

        expect(later.error).toBeNull()
        expect(later.runId).not.toBe(runId)
        expect(later.ending?.status).not.toBe("held")
        expect(db.lines.slice(lines).map((line) => line.text)).toEqual([REPLY])
    })
})
