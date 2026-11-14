import { Test } from "@nestjs/testing"
import { ProviderTriggersError, ProviderTriggersErrorCode } from "./errors/provider-triggers.error"
import { PROVIDER_TRIGGERS } from "./provider-triggers.catalogue"
import type { ProviderEvent, ProviderTriggerDeclaration } from "./provider-triggers.contracts"
import {
    declarationOf,
    triggerDeciderOf,
    payloadProblems,
    planWakes,
    providerTriggerLookup,
    triggerInfoOf,
    wakeContextOf,
} from "./provider-triggers.policy"

const SUBJECT = Symbol("provider-triggers.policy")

/** The policy, provided the way Nest provides a value. */
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    declarationOf,
                    triggerDeciderOf,
                    payloadProblems,
                    planWakes,
                    providerTriggerLookup,
                    triggerInfoOf,
                    wakeContextOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./provider-triggers.policy")>(SUBJECT)
}

const declared = (provider: string, name: string): ProviderTriggerDeclaration => {
    const found = declarationOf(provider, name)
    if (found === null) throw new ProviderTriggersError({ code: ProviderTriggersErrorCode.Undeclared, params: { provider, name } })
    return found
}

const BANK = declared("sepay", "transaction.received")
const MAIL = declared("imap", "mail.received")

const credit = (id: string, at?: string): ProviderEvent => ({
    id,
    occurredAt: at === undefined ? null : new Date(at),
    payload: { transactionId: `tx-${id}`, direction: "in" },
})

describe("the declared provider triggers", () => {
    it("declares the bank movement for every bank feed, the mailbox's new mail and every compose provider's finished render, each with words in both languages", () => {
        expect(PROVIDER_TRIGGERS.map((entry) => `${entry.provider}:${entry.name}`)).toEqual([
            "sepay:transaction.received",
            "payos:transaction.received",
            "casso:transaction.received",
            "imap:mail.received",
            "shotstack:render.completed",
            "creatomate:render.completed",
            "json2video:render.completed",
        ])
        // Only the render completion is on before anyone switches it (it reports work NIVO itself asked for, rule 6a).
        expect(PROVIDER_TRIGGERS.filter((entry) => entry.onByDefault === true).map((entry) => entry.provider)).toEqual([
            "shotstack",
            "creatomate",
            "json2video",
        ])
        for (const entry of PROVIDER_TRIGGERS) {
            expect(entry.description.vi).not.toBe("")
            expect(entry.description.en).not.toBe("")
            for (const field of entry.payload) expect([field.description.vi, field.description.en]).not.toContain("")
        }
    })

    it("holds no free text field: a payload is ids, counts and closed choices", () => {
        const types = new Set(PROVIDER_TRIGGERS.flatMap((entry) => entry.payload.map((field) => field.type)))
        expect([...types].sort()).toEqual(["choice", "id", "integer"])
    })

    it("never batches the bank movement: the deciding path's contract is one transaction per run", () => {
        expect(BANK.batching).toEqual({ mode: "each" })
        expect(BANK.decided).toBe(true)
        expect(MAIL.batching).toEqual({ mode: "list", maxEvents: 50 })
        expect(MAIL.decided).toBe(false)
    })
})

describe("payloadProblems", () => {
    it("takes exactly the declared fields with their types", async () => {
        const policy = await build()
        expect(policy.payloadProblems(BANK, { transactionId: "tx-1", direction: "in" })).toEqual([])
    })

    it("names a missing field, a value outside the closed choices and a member the declaration lacks", async () => {
        const policy = await build()
        expect(policy.payloadProblems(BANK, { direction: "sideways", content: "CK tien hang" })).toEqual([
            "transactionId",
            "direction",
            "content",
        ])
    })

    it("refuses a sentence where an id is declared", async () => {
        const policy = await build()
        expect(policy.payloadProblems(BANK, { transactionId: "chuyen khoan thang 11", direction: "in" })).toEqual(["transactionId"])
    })
})

describe("planWakes", () => {
    it("starts one run per bank movement, about its transaction", async () => {
        const policy = await build()
        const planned = policy.planWakes(BANK, "conn-1", [credit("a"), credit("b")])
        expect(planned).toEqual([
            {
                eventIds: ["a"],
                subject: "bank-transaction:tx-a",
                wake: {
                    providerTrigger: "sepay:transaction.received",
                    connectionId: "conn-1",
                    params: { transactionId: "tx-a", direction: "in" },
                },
            },
            {
                eventIds: ["b"],
                subject: "bank-transaction:tx-b",
                wake: {
                    providerTrigger: "sepay:transaction.received",
                    connectionId: "conn-1",
                    params: { transactionId: "tx-b", direction: "in" },
                },
            },
        ])
    })

    it("starts one run per sync for the mailbox, with the ids and the summed count, in groups of at most 50", async () => {
        const policy = await build()
        const one = policy.planWakes(MAIL, "box-1", [{ id: "run-1", payload: { count: 7 } }])
        expect(one).toEqual([
            {
                eventIds: ["run-1"],
                subject: null,
                wake: { providerTrigger: "imap:mail.received", connectionId: "box-1", params: { eventIds: ["run-1"], count: 7 } },
            },
        ])
        const many = Array.from({ length: 120 }, (_unused, index): ProviderEvent => ({ id: `run-${index}`, payload: { count: 1 } }))
        expect(policy.planWakes(MAIL, "box-1", many).map((planned) => planned.wake.params.count)).toEqual([50, 50, 20])
    })
})

describe("the one decider of an account trigger", () => {
    const AGENTS = ["core", "plugin", "other"]
    const CHOICES: ReadonlyArray<string | null> = [null, ...AGENTS]

    it("names at most one agent whatever is bound, so two deciders cannot exist", async () => {
        const policy = await build()
        for (const core of CHOICES) {
            for (const bound of CHOICES) {
                const decider = policy.triggerDeciderOf(BANK, core, bound)
                const deciders = AGENTS.filter((agent) => agent === decider)
                expect(deciders.length).toBeLessThanOrEqual(1)
                expect(decider).toBe(core ?? bound)
            }
        }
    })

    it("keeps the provider's core agent the decider while it is bound, whoever the owner bound", async () => {
        const policy = await build()
        expect(policy.triggerDeciderOf(BANK, "core", "plugin")).toBe("core")
        expect(policy.triggerDeciderOf(BANK, "core", "plugin")).not.toBe("plugin")
    })

    it("lets the owner's bound agent decide where no core agent is", async () => {
        const policy = await build()
        expect(policy.triggerDeciderOf(BANK, null, "plugin")).toBe("plugin")
    })

    it("names nobody on a trigger nobody decides on", async () => {
        const policy = await build()
        expect(policy.triggerDeciderOf(MAIL, "core", "plugin")).toBeNull()
    })
})

describe("the wake of a run", () => {
    it("carries the trigger, the account, the agent's part and the params only", async () => {
        const policy = await build()
        const planned = policy.planWakes(BANK, "conn-1", [credit("a")])
        expect(planned.map((one) => policy.wakeContextOf(one.wake, "notice"))).toEqual([
            {
                transactionId: "tx-a",
                direction: "in",
                providerTrigger: "sepay:transaction.received",
                connectionId: "conn-1",
                role: "notice",
            },
        ])
    })
})

describe("what a registering workflow is checked against", () => {
    // Ledger (ROAD Opus-1f, 2026-11-14, coordinator R44): the event reaches MATCH as the generic scope of the one pipeline, so what a
    // registration is checked against is that scope (its payload fields under `data`), and a filter names `data.<field>`; the old flat
    // members (`providerTrigger`, `connectionId`, `role`) are no member of a delivered event.
    it("supplies the generic scope with the bank movement's fields in `data`, and lets a filter compare `data.direction` alone", async () => {
        const policy = await build()
        const info = policy.triggerInfoOf(BANK)
        expect(info.supplies.map((param) => `${param.name}:${param.type}`)).toEqual([
            "eventId:string",
            "accountId:string",
            "data:object",
            "locale:string",
        ])
        expect(info.supplies.find((param) => param.name === "data")?.members).toEqual([
            { name: "transactionId", type: "string" },
            { name: "direction", type: "string" },
        ])
        expect(info.filterable).toEqual(["data.direction"])
    })

    it("supplies the ids and the count of a mailbox sync and no filterable field", async () => {
        const policy = await build()
        const info = policy.triggerInfoOf(MAIL)
        expect(info.supplies.map((param) => `${param.name}:${param.type}`).slice(0, 2)).toEqual(["eventIds:array", "count:integer"])
        expect(info.filterable).toEqual([])
    })

    it("looks a trigger up by its key and knows no other", async () => {
        const policy = await build()
        expect(policy.providerTriggerLookup("sepay:transaction.received")).toEqual(policy.triggerInfoOf(BANK))
        expect(policy.providerTriggerLookup("sepay:refund.received")).toBeUndefined()
    })
})
