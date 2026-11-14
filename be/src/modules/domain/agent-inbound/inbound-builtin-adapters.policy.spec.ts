import { Test } from "@nestjs/testing"
import { wakeSources } from "@modules/domain/agent-work"
import { wakeTraitsOf } from "./inbound-adapter.policy"
import { NO_DOOR, builtInAdapters } from "./inbound-builtin-adapters.policy"

const SUBJECT = Symbol("inbound-builtin-adapters.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { builtInAdapters } }],
    }).compile()
    return moduleRef.get<typeof import("./inbound-builtin-adapters.policy")>(SUBJECT)
}

/** What the work core gave each of the three sources before adapters existed, in the order tag, internal, schedule. */
const TODAYS_TRAITS = [
    {
        priority: 20,
        maxAttempts: 3,
        scopedToConversation: false,
        background: false,
        restoresHeld: true,
        awaitsAnswer: false,
    },
    {
        priority: 30,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
    {
        priority: 40,
        maxAttempts: 3,
        scopedToConversation: false,
        background: true,
        restoresHeld: false,
        awaitsAnswer: false,
    },
]

const ACTOR = { kind: "member", id: "m-1", role: "staff" }

describe("builtInAdapters", () => {
    it("declares the three sources that existed before adapters and still write wakes, once each: no customer source (the channels deliver)", async () => {
        const { builtInAdapters } = await buildSubject()

        expect(builtInAdapters().map((adapter) => adapter.key)).toEqual(["tag", "internal", "schedule"])
    })

    it("derives for each of them the traits the work core gave it before adapters, which are the traits the core records", async () => {
        const { builtInAdapters } = await buildSubject()
        const adapters = builtInAdapters()

        expect(adapters.map(wakeTraitsOf)).toEqual(TODAYS_TRAITS)
        expect(adapters.map((adapter) => wakeSources.of(adapter.key))).toEqual(TODAYS_TRAITS)
    })

    it("trusts the clock and the events of the business as the system, and a tag by who tagged", async () => {
        const { builtInAdapters } = await buildSubject()
        const trust = (actor: typeof ACTOR) => builtInAdapters().map((adapter) => adapter.trustOf(actor))

        expect(trust(ACTOR)).toEqual(["member", "system", "system"])
        expect(trust({ ...ACTOR, role: "owner" })).toEqual(["manager", "system", "system"])
        expect(trust({ kind: "agent", id: "a-1", role: "" })).toEqual(["member", "system", "system"])
    })

    it("gives no wake context of its own for any of them", async () => {
        const { builtInAdapters } = await buildSubject()

        expect(builtInAdapters().map((adapter) => adapter.wakeContextOf)).toEqual([undefined, undefined, undefined])
    })

    it("names the door and the reply of each adapter, and no door for the two that never take the contract pipeline", async () => {
        const { builtInAdapters } = await buildSubject()

        expect(builtInAdapters().map((adapter) => [adapter.doorStep, adapter.replyStep])).toEqual([
            ["tag_door", null],
            [NO_DOOR, null],
            [NO_DOOR, null],
        ])
    })
})
