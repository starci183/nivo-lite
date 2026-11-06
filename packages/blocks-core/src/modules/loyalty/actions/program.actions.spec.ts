import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { sampleState, SAMPLE_NOW, SAMPLE_PROGRAM } from "../fixtures/loyalty.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { loyaltyDecisions } from "../ports"
import { saveProgramAction, syncMembersAction } from "./program.actions"
import { decideAction, draftCampaignAction, previewSegmentAction } from "./promo.actions"

const contextOf = (memberId: string | null): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date(SAMPLE_NOW),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
})

/** What running stands in for an action that does not run in the package, which the expectation before it already failed. */
const notRunnable = (): Promise<ActionResult> =>
    Promise.resolve({ ok: false, reason: "failed", message: { key: "not_runnable" } })

const run = (
    action: ActionDefinition,
    raw: unknown,
    state: MemoryState = sampleState(),
    memberId: string | null = "staff-1",
    provider: PortProvider = memoryProvider(state),
): Promise<ActionResult> => {
    expect(action.execute).toBeDefined()
    return (action.execute ?? notRunnable)(provider, raw, contextOf(memberId))
}

/** A provider whose port `id` answers as the given overrides say, and every other port as the memory does. */
const overriding = (state: MemoryState, id: string, overrides: Record<string, unknown>): PortProvider => {
    const provider = memoryProvider(state)
    return {
        implementationOf: (port) => {
            const implementation = provider.implementationOf(port)
            if (port.id !== id || typeof implementation !== "object" || implementation === null) return implementation
            return { ...implementation, ...overrides }
        },
    }
}

describe("loyalty.save-program", () => {
    it("saves the rules over the saved ones, clamped, and keeps the tiers and the slug", async () => {
        const state = sampleState()
        const result = await run(
            saveProgramAction,
            {
                name: "  Hoa Mai  ",
                enabled: false,
                perThousandVnd: 2,
                perVisit: 5,
                minOrderVnd: 20_000,
                trigger: "order",
                expiryMonths: 500,
                warnDays: 14,
                birthdayOn: false,
                birthdayPoints: 50,
                birthdayReward: "giam-10",
                birthdayNote: "Happy",
                maxPerMonth: 2,
                hourFrom: "09:00",
                hourTo: "20:00",
                batch: 10,
            },
            state,
        )
        expect(result).toEqual({ ok: true, data: { slug: "hoa-mai-coffee" } })
        expect(state.program).toMatchObject({
            name: "Hoa Mai",
            slug: "hoa-mai-coffee",
            enabled: false,
            version: "2",
            config: {
                earn: { perThousandVnd: 2, perVisit: 5, minOrderVnd: 20_000, trigger: "order" },
                expiry: { months: 120, warnDays: 14 },
                birthday: { enabled: false, points: 50, rewardKey: "giam-10", note: "Happy" },
                promo: { maxPerMonth: 2, hourFrom: "09:00", hourTo: "20:00", batch: 10 },
            },
        })
        expect(state.program?.config.tiers).toEqual(SAMPLE_PROGRAM.config.tiers)
    })

    it("keeps what a field leaves out", async () => {
        const state = sampleState()
        await run(saveProgramAction, { id: "", name: "Hoa Mai Coffee" }, state)
        expect(state.program).toMatchObject({ enabled: true, config: SAMPLE_PROGRAM.config })
    })

    it("makes the slug from the name on the first save, over the starter rules", async () => {
        const state = sampleState({ program: null })
        expect(await run(saveProgramAction, { name: "Quan Ca Phe", enabled: true }, state)).toEqual({
            ok: true,
            data: { slug: "quan-ca-phe" },
        })
        expect(state.program).toMatchObject({ enabled: true, version: "1" })
    })

    it("answers invalid for a blank name", async () => {
        expect(await run(saveProgramAction, { name: "" })).toMatchObject({
            reason: "invalid",
            fields: { name: { key: "renderer.invalid" } },
        })
    })
})

describe("loyalty.sync-members", () => {
    it("answers how many customers were made and how many leads were linked", async () => {
        expect(await run(syncMembersAction, { id: "" })).toEqual({ ok: true, data: { created: 2, linked: 3 } })
    })
})

describe("loyalty.draft-campaign and loyalty.preview-segment", () => {
    it("writes the draft of a promotion in the name of the member who asks", async () => {
        const state = sampleState()
        expect(
            await run(
                draftCampaignAction,
                { name: " Win back ", brief: " 10% off ", tiers: ["bac"], inactiveDays: 60.4, minSpendVnd: 1_000_000 },
                state,
            ),
        ).toEqual({ ok: true, data: { campaignId: "c-3", status: "waiting", recipients: 0 } })
        expect(state.campaigns.at(-1)).toMatchObject({
            name: "Win back",
            draft: "10% off",
            createdBy: "staff-1",
            segment: { tiers: ["bac"], inactiveDays: 60, birthdayThisMonth: false, minSpendVnd: 1_000_000 },
        })
    })

    it("names a promotion after nothing when none is given, and the agent signs as NIVO", async () => {
        const state = sampleState()
        await run(draftCampaignAction, { birthdayThisMonth: true, inactiveDays: null, minSpendVnd: null }, state, null)
        expect(state.campaigns.at(-1)).toMatchObject({
            name: "Promotion",
            draft: "",
            createdBy: "NIVO",
            segment: { tiers: [], birthdayThisMonth: true },
        })
    })

    it("counts the customers a segment holds, how many can be reached and the first names", async () => {
        expect(await run(previewSegmentAction, { tiers: ["dong"] })).toEqual({
            ok: true,
            data: { total: 2, reachable: 1, sample: ["Le Minh Chau", "Vo Hoang Nam"] },
        })
        expect(await run(previewSegmentAction, {})).toMatchObject({ data: { total: 5, reachable: 3 } })
    })
})

describe("loyalty.decide", () => {
    it("approves or rejects a waiting decision, which then no longer waits", async () => {
        const state = sampleState()
        expect(await run(decideAction, { id: "d-1", command: "approve" }, state)).toEqual({
            ok: true,
            data: { id: "d-1" },
        })
        expect(state.decisions.map((decision) => decision.id)).toEqual(["d-2"])
        await run(decideAction, { id: "d-2", command: "reject" }, state)
        expect(state.decisions).toEqual([])
    })

    it("passes the verdict to the store", async () => {
        const state = sampleState()
        const verdicts: Array<string> = []
        const spy = overriding(state, loyaltyDecisions.id, {
            decide: (id: string, verdict: string) => {
                verdicts.push(`${id}:${verdict}`)
                return Promise.resolve({ ok: true, row: state.decisions[0] })
            },
        })
        await run(decideAction, { id: "d-1", command: "approve" }, state, "s", spy)
        await run(decideAction, { id: "d-1", command: "reject" }, state, "s", spy)
        expect(verdicts).toEqual(["d-1:approved", "d-1:rejected"])
    })

    it("refuses as data a decision that is gone, answers a conflict when the store does, and refuses an unknown command", async () => {
        expect(await run(decideAction, { id: "nobody", command: "approve" })).toMatchObject({
            message: { key: "refusal_decision_missing" },
        })
        const state = sampleState()
        const conflict = overriding(state, loyaltyDecisions.id, {
            decide: () => Promise.resolve({ ok: false, reason: "conflict" }),
        })
        expect(await run(decideAction, { id: "d-1", command: "approve" }, state, "s", conflict)).toMatchObject({
            reason: "conflict",
        })
        expect(await run(decideAction, { id: "d-1", command: "edit" })).toMatchObject({
            reason: "invalid",
            fields: { command: { key: "renderer.invalid" } },
        })
    })
})
