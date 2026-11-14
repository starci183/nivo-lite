import { CORE_WAIT } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CONV, customerWrites, drain, threadDbOf } from "./thread-world"
import { coreProcessOf, coreStarted, threadOf } from "./thread-world-core"

// WORLD (d) of the backlog (engine-core rule 8, offer order): when TWO runs of one subject are parked on a `wait` that lists the verb, an event is
// offered to the LATEST waiter first (a child before its parent, then the latest waiter); the one that takes it goes on, the other stays parked
// and takes the NEXT event. Real: the Zalo entry, `deliver`, the waits service over the real run store (wait marks), the thread engine. Doubles:
// the model (not asked), the wake table, the outside world.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

const TRIGGER = { noteId: "note-1", text: "da ghi", word: "A12", conversationId: CONV, routeId: CONV, locale: "vi" }

describe("two runs parked on one route: the latest waiter takes the event first", () => {
    it("the later run takes the first line; the earlier run stays parked and takes the next", async () => {
        const db = threadDbOf()
        const process = await coreProcessOf(db)
        const older = await coreStarted(process, CORE_WAIT, TRIGGER, 1)
        const newer = await coreStarted(process, CORE_WAIT, TRIGGER, 2)
        expect((await threadOf(process, older)).status).toBe("stopped")
        expect((await threadOf(process, newer)).status).toBe("stopped")

        const from = db.wakes.length
        const first = await customerWrites(process, "cam on shop")
        await drain(process, from)

        expect(first.ending).toMatchObject({ reason: "wait_took" })
        expect((await threadOf(process, newer)).status).toBe("ended")
        expect((await threadOf(process, older)).status).toBe("stopped")

        const again = db.wakes.length
        await customerWrites(process, "them nua nhe shop")
        await drain(process, again)

        expect((await threadOf(process, older)).status).toBe("ended")
    })
})
