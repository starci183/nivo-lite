import { Test } from "@nestjs/testing"
import { conditionsHold } from "@nivo-lite/agent-sdk/graph"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { conditionsOfSource, sourcesOfTrigger } from "./trigger-specs.policy"

/**
 * A BANK CREDIT IS THE MOVEMENT IN. Every bank feed emits `transaction.received` for each movement of its account (`direction` `in` or
 * `out`); the registry narrows the verb `payment.credit.received` on every one of those sources to `direction = in`, so a registration the
 * engine derives for the verb never takes an outgoing movement. A graph that listens to the verb therefore holds no `direction` test of
 * its own.
 *
 * Ledger (ROAD Opus-1f, 2026-11-14, coordinator R44 after S5c's finding): the event reaches MATCH as the generic scope of the one
 * pipeline (`eventId`, `accountId`, `data`), so the movement is `data.direction`; the narrowing named a top-level `direction` that no
 * delivered credit carries (no registration ever took a real credit). The samples are now the delivered scope, read by path.
 */

interface Subject {
    readonly conditionsOfSource: typeof conditionsOfSource
    readonly sourcesOfTrigger: typeof sourcesOfTrigger
}

const SUBJECT = Symbol("trigger-specs.credit-narrowing")

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { conditionsOfSource, sourcesOfTrigger } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const BANK_FEEDS = [PROVIDER.sepay, PROVIDER.casso, PROVIDER.payos] as const

describe("the verb payment.credit.received keeps the money in of a bank feed's movements", () => {
    it("every provider source of the verb (SePay, Casso, PayOS) is the feed's movement trigger and carries direction = in", async () => {
        const subject = await build()
        const sources = subject.sourcesOfTrigger(TRIGGER.paymentCreditReceived, [...BANK_FEEDS])
        expect(sources.map((source) => [source.kind, source.provider, source.trigger])).toEqual(
            BANK_FEEDS.map((provider) => ["provider", provider, "transaction.received"]),
        )
        for (const source of sources) {
            expect(subject.conditionsOfSource(TRIGGER.paymentCreditReceived, source)).toEqual([
                { param: "data.direction", op: "equals", value: "in" },
            ])
        }
    })

    it("the conditions hold for the wake of a movement in and fail for the wake of a movement out (or one naming no direction)", async () => {
        const subject = await build()
        for (const source of subject.sourcesOfTrigger(TRIGGER.paymentCreditReceived, [...BANK_FEEDS])) {
            const conditions = subject.conditionsOfSource(TRIGGER.paymentCreditReceived, source)
            const scopeOf = (data: Readonly<Record<string, unknown>>) => ({ eventId: "tx-1", accountId: "acc-1", data })
            expect(conditionsHold(conditions, scopeOf({ transactionId: "tx-1", direction: "in" }))).toBe(true)
            expect(conditionsHold(conditions, scopeOf({ transactionId: "tx-1", direction: "out" }))).toBe(false)
            expect(conditionsHold(conditions, scopeOf({ transactionId: "tx-1" }))).toBe(false)
            // A top-level `direction` is not the event's movement: only the delivered `data` counts.
            expect(conditionsHold(conditions, { eventId: "tx-1", direction: "in", data: { direction: "out" } })).toBe(false)
        }
    })
})

// What a FRESH SEED installs (R44/R45, item 4 of ROAD Opus-1g): a workflow version stores the engine graph the installation compiles from
// the package template (`graphOfSpecV2` -> `conditionsOfSource`), so a seeded or installed registration on a bank feed's movement carries
// `data.direction = in`. A version stored before the R44 change keeps its old `direction` until `tools reseed` replaces it (the graphs
// differ, so the plan is `replace`); a boot re-derives nothing.
describe("the installed graphs registered on a bank feed's movement (what a fresh seed stores)", () => {
    it("each such registration carries data.direction = in, never a top-level direction", () => {
        const registrations = INSTALLED.templates().flatMap((template) =>
            (latestTemplateVersion(template).graph.triggers ?? []).filter(
                (one) => one.source.kind === "provider" && one.source.trigger === "transaction.received",
            ),
        )
        expect(registrations.length).toBeGreaterThan(0)
        for (const registration of registrations) {
            expect(registration.conditions).toEqual(expect.arrayContaining([{ param: "data.direction", op: "equals", value: "in" }]))
            expect((registration.conditions ?? []).some((condition) => condition.param === "direction")).toBe(false)
        }
    })
})
