import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { RunStopRecordsService, StopHandBackService, stopCardStateOf } from "@modules/domain/agent-threads"
import { AgentWorkAccessService } from "@modules/domain/agent-work"
import { DoorPressesService } from "@modules/domain/agent-doors/door-presses.service"
import { HoldReleaseDoorService } from "@modules/domain/agent-doors/hold-release-door.service"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { Logger } from "@modules/platform/logging"
import { heldWakesOf, holdProvidersOf } from "./thread-world-core"
import { chatServicesOf, transactionalManager } from "./thread-world-intake"
import { WS } from "./thread-world-records"
import { worldRunStopStore } from "./thread-world-tables"
import {
    ANSWER,
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
// route hold, but the resume event was held behind the SAME stop's run, the run never resumed, and the stop stayed taken over so
// the card kept its hand-back button). The REAL hand-back door (`HoldReleaseDoorService.handAs`, what the GraphQL door and the
// `platform.route-holds` port run) over the REAL route store, the REAL stop records and resume door, the REAL release door
// (`HeldLinesService`: the one resume event through the REAL `deliver`), and the REAL subject hold of the stops (`holdProvidersOf`, rule Q-1).
//
// Why no test caught it: the door's own spec mocks the release door and counts its wakes as the answer (`answered: 1` is "released" though
// the wake is then held); the R45 hand-back worlds (`sale-edges.spec.ts`) hold the route over a sale PARKED AT A WAIT, never over a STOP a
// person took over, so no hold stood between the resume event and the agent; and the take-over world (`take-over.spec.ts`) ends its
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
    it("clears the hold, closes the taken-over stop, releases the event held behind it, and the ONE resume event makes the agent answer once", async () => {
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

        // The drain, in the order dev saw it: the resume event first. While the stop is still open its run holds the event: held `waiting:<run>` (rule Q-1) ...
        const first = await runTurns(process, resumeEvents)
        expect(first.map((one) => one.ending?.status)).toEqual(["held"])
        // ... then the run's ending decision: the stop resolves (decided by the person who handed back), the run that waited at the gate ends.
        await expect(drain(process, fromWakes)).resolves.toEqual([expect.objectContaining({ error: null })])
        const [stop] = await stopsOf(process, runId)
        // Rule S-3 (E-SMALL): the closing kind is the hand-back's own, never a skip: on the stop, on its card and on the run's record.
        expect(stop).toMatchObject({ state: "resolved", decision: { kind: "handed_back", by: "owner-1" } })
        // The card reads the stop as closed: no "taken over", nothing it still takes (no hand-back button: the card's own rule).
        expect(stop === undefined ? null : stopCardStateOf(stop)).toMatchObject({
            state: "handed_back",
            takenOver: false,
            needs: { answer: false, decisions: [] },
        })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled", error: { code: "handed_back" } })

        // The run is finished, so the event held behind it is pending again (the SAME wake, once: nothing is written anew): it starts the
        // agent's next turn, which reads the thread and answers once.
        expect(resumeEvents[0]).toMatchObject({ state: "pending" })
        expect(db.wakes.slice(fromWakes + 1)).toEqual([])
        expect(heldWakesOf(db)).toEqual([])
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, sends(REPLY), { done: { reply: REPLY } })
        const replayed = await runTurns(process, resumeEvents)
        expect(replayed.map((one) => one.error)).toEqual([null])
        expect(db.lines.slice(lines).map((line) => line.text)).toEqual([REPLY])
        expect([...db.runs.keys()]).toHaveLength(2)
    })

    it("a second press before the drain applied the first writes no second ending decision and delivers no second resume event", async () => {
        const { db, process, runId } = await takenOver()
        const door = handBackDoorOf(db, process)
        await door.handAs(WS, "owner-1", CONV)
        const fromWakes = db.wakes.length
        const fromChat = db.chat.wakes.length

        // The ending decision of the first press is not applied yet (the drain has not run): the stop is still open, its decision recorded.
        // Nothing is held any more (the hold was cleared) and the take-over's ending was admitted once: the press ends nothing (DEF-4).
        await expect(door.handAs(WS, "owner-1", CONV)).resolves.toEqual({ outcome: "nothing_held", answered: 0 })

        expect(db.wakes.slice(fromWakes).filter((wake) => wake.context.subjectId === runId)).toEqual([])
        expect(db.chat.wakes.slice(fromChat)).toEqual([])
    })

    // MX-CORE DEF-4 (dev 2026-11-14, row H-03): after a hand-back that released (hold cleared, stop resolved, freeze released, the agent
    // answered), a SECOND press answered `released, answered 1`, delivered a second resume event, a parked wait took it and the agent sent a
    // second real message with no new line of the person. Why this world missed it: it never pressed again after the road had run.
    it("DEF-4: a second press after the whole hand-back road ran answers nothing_held, delivers nothing, and the agent says nothing more", async () => {
        const { db, process } = await takenOver()
        const door = handBackDoorOf(db, process)
        const fromWakes = db.wakes.length
        await expect(door.handAs(WS, "owner-1", CONV)).resolves.toMatchObject({ outcome: "released", answered: 1 })
        await runTurns(process, db.chat.wakes)
        await drain(process, fromWakes)
        db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
        db.model.script(ANSWER, sends(REPLY), { done: { reply: REPLY } })
        // The run ended, so the held resume event is pending again (rule Q-1): the agent answers it.
        await runTurns(process, db.chat.wakes)
        const lines = db.lines.length
        const wakes = db.wakes.length
        const fromChat = db.chat.wakes.length

        await expect(door.handAs(WS, "owner-1", CONV)).resolves.toEqual({ outcome: "nothing_held", answered: 0 })

        expect(db.chat.wakes.slice(fromChat)).toEqual([])
        expect(db.wakes).toHaveLength(wakes)
        expect(db.lines).toHaveLength(lines)
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
        // A Skip stays a skip (rule S-3's control): the run's record names the founder's skip, the card reads "skipped".
        expect(stop === undefined ? null : stopCardStateOf(stop)).toMatchObject({ state: "skipped" })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled", error: { code: "skipped_by_founder" } })
        // Whatever the run's end releases (the events held behind it) is drained first.
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
