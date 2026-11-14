import { mock, mockEntityManager } from "@starci/jest-preset"
import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import { CORE_AGENT, CORE_TIMER_A, CORE_TIMER_B } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { timerTaskOf, type AgentTasksService, type AgentTaskData, type AgentWakeContext } from "@modules/domain/agent-work"
import { ClockTickDeliveryService } from "@modules/domain/agent-schedules/clock-tick-delivery.service"
import { TIMER_DUE_TRIGGER } from "@modules/domain/agent-schedules/engine-time.triggers"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import type { ConversationContactsService } from "@modules/domain/contacts"
import type { NativeCaller } from "@modules/domain/tools"
import { TIMER_TOOL, TimerNativeService } from "@modules/domain/timer-tools"
import { CONTACT, CONV, FRONT, WS, runTurns, threadDbOf, type ThreadDb, type ThreadProcess, type Woken } from "./thread-world"
import { chatServicesOf } from "./thread-world-intake"
import { coreProcessOf, noteActsOf } from "./thread-world-core"

/** The task table, in memory: the store over it and its rows. */
interface TaskTable {
    /** The store the timers go through. */
    readonly store: AgentTasksService
    /** The rows, by the agent's key. */
    readonly rows: Map<string, Row>
}


// ENGINE CORE: TIMER KEYING. Several graphs of ONE agent each register `nivo.trigger.timer.due` and each takes only the timers whose
// ARM put its declared data field in `data` (`where: data.kind`), on the generic fixture agent (`tcore.timer-a` / `tcore.timer-b`). Real:
// the timer tools (`TimerNativeService`: arm / cancel), the task keys and the due delivery (`ClockTickDeliveryService.deliverTimer` through the real `deliver`, as the minute
// sweep does), the flow's routing (`takingTriggerOf` over the agent's graphs), the thread run. Faked: the task table (a small
// in-memory store of the rows `AgentTasksService` keeps) and the sweep's own query (a row due at or before now); the model is not asked.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** One row of the task table a timer is kept in. */
interface Row {
    readonly key: string
    readonly title: string
    readonly wakeAt: Date
    readonly data: AgentTaskData | null
    open: boolean
}

/** The task table, in memory: what `armTimer` and `cancelTimer` of the real store do to a row, by the agent's key. */
const tasksOf = (): TaskTable => {
    const rows = new Map<string, Row>()
    const store = mock<AgentTasksService>({
        armTimer: (_workspaceId: string, _agentId: string, timer: Omit<Row, "open">) => {
            rows.set(timer.key, { ...timer, open: true })
            return Promise.resolve()
        },
        cancelTimer: (_agentId: string, key: string) => {
            const row = rows.get(key)
            const was = row?.open === true
            if (row !== undefined) row.open = false
            return Promise.resolve(was)
        },
    })
    return { store, rows }
}

const caller = { agentId: FRONT, conversationId: CONV, run: { contactId: CONTACT } } as unknown as NativeCaller

/** A world whose agent runs the fixture's graphs, the timer tools over it, and the sweep's pass over the rows. */
const worldOf = async () => {
    const db: ThreadDb = threadDbOf({ modules: { [FRONT]: CORE_AGENT } })
    const process: ThreadProcess = await coreProcessOf(db)
    const { store, rows } = tasksOf()
    const conversations = mock<ConversationContactsService>({ contactOf: () => Promise.resolve(CONTACT) })
    const timers = new TimerNativeService(store, conversations, db.clock)
    const arm = (args: Record<string, unknown>) => timers.invoke(WS, TIMER_TOOL.arm, args as never, caller)
    const cancel = (ref: string) => timers.invoke(WS, TIMER_TOOL.cancel, { ref }, caller)

    /**
     * The sweep's pass: every open row that fell due is delivered through the timer's REAL entry (`ClockTickDeliveryService.deliverTimer`: the
     * declaration's pure translate, the real `deliver` and MATCH on the registrations of the agent's graphs), and the wakes it wrote are run.
     */
    const tags: Array<AgentWakeContext> = []
    const sweep = async (): Promise<ReadonlyArray<Woken>> => {
        const now = db.clock.now()
        const entry = new ClockTickDeliveryService(chatServicesOf(db).triggers)
        triggerDeclarations.register(TIMER_DUE_TRIGGER)
        const before = db.chat.wakes.length
        for (const [key, row] of rows) {
            if (!row.open || row.wakeAt.getTime() > now.getTime()) continue
            row.open = false
            const timer = timerTaskOf(key, row.title, row.data)
            if (timer === null) continue
            await entry.deliverTimer(mockEntityManager(), { workspaceId: WS, agentId: FRONT }, `task-${key}`, timer, null)
        }
        const wakes = db.chat.wakes.slice(before)
        tags.push(...wakes.map((wake) => wake.context))
        return runTurns(process, wakes)
    }
    return { db, process, arm, cancel, sweep, tags }
}

/** The graph (its template key) each run of the database was opened on: its version id is `<agent>:<workflow>@<n>`. */
const graphsOf = (db: ThreadDb): ReadonlyArray<string> =>
    [...db.runs.values()].map((run) => `${CORE_AGENT}.${((run.versionId ?? "").split("@")[0] ?? "").split(":").at(-1) ?? ""}`)

describe("two graphs of one agent keyed by a declared data field of timer.due", () => {
    it("each takes only the timers its arm marked with its kind: r1 starts A with { ref, data }, r2 starts B", async () => {
        const { db, arm, sweep } = await worldOf()
        await arm({ ref: "r1", afterMinutes: 5, data: { kind: "a" } })
        await arm({ ref: "r2", afterMinutes: 5, data: { kind: "b" } })
        db.clock.advance(6 * 60_000)

        const woken = await sweep()

        expect(woken.map((one) => one.error)).toEqual([null, null])
        expect(graphsOf(db).toSorted()).toEqual([CORE_TIMER_A, CORE_TIMER_B])
        expect(noteActsOf(db).map((act) => [act.payload.noteId, act.payload.text]).toSorted()).toEqual([
            ["r1", "a"],
            ["r2", "b"],
        ])
    })

    it("a timer of a kind no graph declares starts nothing, and nothing starts before the timer is due", async () => {
        const { db, arm, sweep } = await worldOf()
        await arm({ ref: "r1", afterMinutes: 5, data: { kind: "unknown" } })
        await arm({ ref: "r2", afterMinutes: 5 })
        await arm({ ref: "r3", afterMinutes: 90, data: { kind: "a" } })
        db.clock.advance(6 * 60_000)

        await sweep()

        expect(noteActsOf(db)).toEqual([])
        expect(graphsOf(db).filter((graph) => graph === CORE_TIMER_A || graph === CORE_TIMER_B)).toEqual([])
    })

    it("a timer cancelled before it is due starts nothing, and cancelling again answers that none was armed", async () => {
        const { db, arm, cancel, sweep } = await worldOf()
        await arm({ ref: "r1", afterMinutes: 5, data: { kind: "a" } })
        expect(await cancel("r1")).toEqual({ cancelled: true })
        expect(await cancel("r1")).toEqual({ cancelled: false })
        db.clock.advance(6 * 60_000)

        expect(await sweep()).toEqual([])
        expect(noteActsOf(db)).toEqual([])
    })

    it("the due wake carries BOTH the contact and the conversation the arming run served, with the ref and the data", async () => {
        const { db, arm, sweep, tags } = await worldOf()
        await arm({ ref: "r1", afterMinutes: 5, data: { kind: "a" } })
        db.clock.advance(6 * 60_000)

        await sweep()

        const [context] = tags
        // The person and the route ride beside the event; the event's data (the ref, the open data the arm gave, the due instant) is its `dataJson`.
        expect(context).toMatchObject({ contactId: CONTACT, conversationId: CONV })
        expect(jsonTextOf(String(context?.dataJson))).toMatchObject({ ref: "r1", data: { kind: "a" } })
    })
})
