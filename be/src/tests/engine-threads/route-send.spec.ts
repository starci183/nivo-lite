import { INSTALLED } from "@modules/domain/installed-plugins"
import { ROUTES_TELL } from "@tests/fixtures/builders/route-reach-plugin.builder"
import { chatServicesOf } from "./thread-world-intake"
import { CONTACT, CONV, FRONT, WS, ZALO, processOf, startThread, threadDbOf, type ThreadDb } from "./thread-world"
import { threadOf } from "./thread-world-core"

// E-SMALL item 2 (R79 MXW-3 option A). RULE S-2 (engine words): a customer send may name a ROUTE (the route a record came in on) instead of
// a person; the route's person, channel and account are the address; holds, consent, rights, approval mode and reporting are the same
// as any send. THE EXPOSING SHAPE: a round of NO person (the websales round / a team-chat turn: no contact, no woken route) telling the
// person of a stored record, which answered `no_recipient` before. THE SECOND KIND: a customer's own run (it serves person A, woken on A's
// route) telling ANOTHER person (B) by B's record route: an unprompted message on B's route, never A's.

jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/route-reach-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/route-reach-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.ROUTES_PLUGIN], "route-send") }
})

const flowOf = () => {
    const graph = INSTALLED.templateOf(ROUTES_TELL)?.versions[0]?.graph
    if (graph === undefined) throw new Error("fixture graph missing")
    return graph
}

/** Starts the tell workflow with this trigger; answers its tell step's output. */
const told = async (db: ThreadDb, trigger: Readonly<Record<string, unknown>>) => {
    const process = await processOf(db)
    const woken = await startThread(process, { flow: flowOf(), versionId: `${ROUTES_TELL}@1`, trigger, workflowId: `wf:${ROUTES_TELL}` })
    if (woken.error !== null) throw woken.error
    const { steps } = await threadOf(process, woken.runId ?? "")
    return (steps as Readonly<Record<string, { readonly output?: unknown }>>).tell?.output
}

/** A second person met on the same Zalo account, with their route. */
const secondPerson = async (db: ThreadDb): Promise<string> => {
    const services = chatServicesOf(db)
    const contactId = await services.contacts.meetChannel(WS, { channel: "zalo", account: ZALO, userId: "8800110099", name: "Binh" })
    return (await services.routes.ensure(WS, { contactId, channel: "zalo", accountId: ZALO })).routeId
}

const db = () => threadDbOf({ modules: { [FRONT]: "troutes" } })

describe("a send addressed by a route: a round of no person (the exposing shape)", () => {
    it("tells the record's person on the record's route: one line on that route", async () => {
        const world = db()
        const output = await told(world, { recordRoute: CONV, text: "Don hang cua ban da san sang" })
        expect(output).toEqual({ told: true, reason: null })
        expect(world.lines.map((line) => [line.conversationId, line.text])).toEqual([[CONV, "Don hang cua ban da san sang"]])
    })

    it("a route a member holds is refused `route_held` (the same hold as any send): nothing goes out", async () => {
        const world = db()
        // The default customer is met once, before the first process: make the process (it seeds), then hold the route.
        await processOf(world)
        await expect(chatServicesOf(world).routes.hold(WS, CONV, "m-staff")).resolves.toBe("held")
        const output = await told(world, { recordRoute: CONV, text: "Don hang cua ban da san sang" })
        expect(output).toEqual({ told: false, reason: "route_held" })
        expect(world.lines).toEqual([])
    })

    it("a route the workspace does not hold answers `no_recipient`", async () => {
        const world = db()
        const output = await told(world, { recordRoute: "route-gone", text: "x" })
        expect(output).toEqual({ told: false, reason: "no_recipient" })
        expect(world.lines).toEqual([])
    })
})

describe("a send addressed by a route: a customer's run telling another person (second kind)", () => {
    it("the run serves A on A's route; the send goes to B on B's route, never on A's", async () => {
        const world = db()
        await processOf(world)
        const routeOfB = await secondPerson(world)
        const output = await told(world, { routeId: CONV, contactId: CONTACT, recordRoute: routeOfB, text: "Chao Binh" })
        expect(output).toEqual({ told: true, reason: null })
        expect(world.lines.map((line) => [line.conversationId, line.text])).toEqual([[routeOfB, "Chao Binh"]])
    })
})
