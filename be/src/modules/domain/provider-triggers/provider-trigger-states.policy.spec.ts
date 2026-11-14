import { Test } from "@nestjs/testing"
import { BANK_TRIGGER_WORDS } from "./messages/provider-triggers.messages"
import { PROVIDER_TRIGGERS } from "./provider-triggers.catalogue"
import { canCatchUpOf, namedAgentsOf, triggerStatesOf } from "./provider-trigger-states.policy"
import type { ProviderTriggerDeclaration } from "./provider-triggers.contracts"

const SUBJECT = Symbol("provider-trigger-states.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { canCatchUpOf, namedAgentsOf, triggerStatesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./provider-trigger-states.policy")>(SUBJECT)
}

/** A bank trigger as the catalogue declares it, and one whose provider recovers nothing (no catalogue entry is such today). */
const BANK: ProviderTriggerDeclaration = {
    provider: "sepay",
    name: "transaction.received",
    kind: "webhook",
    description: BANK_TRIGGER_WORDS.trigger,
    payload: [],
    batching: { mode: "each" },
    recovery: "reconcile",
    decided: true,
}
const LOST: ProviderTriggerDeclaration = { ...BANK, name: "lost.received", recovery: "none" }

describe("provider-trigger-states.policy", () => {
    it("lets a switch catch up only where the provider recovers a missed event", async () => {
        const policy = await build()

        expect(policy.canCatchUpOf(BANK)).toBe(true)
        expect(policy.canCatchUpOf(LOST)).toBe(false)
        // The bank feeds and the mailbox recover; a render completion does not (the run that waits for it reads the render's status).
        expect(PROVIDER_TRIGGERS.map((declaration) => policy.canCatchUpOf(declaration))).toEqual([true, true, true, true, false, false, false])
    })

    it("offers the attached agents the directory knows as choices, and none while a core agent decides", async () => {
        const policy = await build()
        const names = new Map([
            ["core", "Accounting"],
            ["plugin", "Renewals"],
        ])
        const facts = { connectionId: "conn-1", declared: [BANK], switches: [], attached: ["plugin", "gone"], names }

        const [free] = policy.triggerStatesOf({ ...facts, coreDeciders: {} })
        const [held] = policy.triggerStatesOf({ ...facts, coreDeciders: { "transaction.received": "core" } })

        expect(free).toMatchObject({ enabled: false, deciderAgentId: null, coreDecides: false })
        expect(free?.deciderChoices).toEqual([{ agentId: "plugin", name: "Renewals" }])
        expect(held).toMatchObject({ deciderAgentId: "core", deciderAgentName: "Accounting", coreDecides: true, deciderChoices: [] })
    })

    it("names every agent a state may name once: core and bound deciders and the attached agents", async () => {
        const policy = await build()
        const switches = [
            { name: "a", enabled: true, enabledAt: null, lastFiredAt: null, firedCount: 0, deciderAgentId: "plugin" },
        ]

        expect(policy.namedAgentsOf({ switches, coreDeciders: { a: "core", b: null }, attached: ["plugin", "reader"] })).toEqual([
            "core",
            "plugin",
            "reader",
        ])
    })
})
