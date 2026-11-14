import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type { MemoryWorld } from "../../ledger/fixtures/accounting.memory"
import { entityApi, rowsOf } from "../../ledger/fixtures/accounting.memory"
import { SAMPLE_NOW, SAMPLE_PROGRAM } from "../fixtures/loyalty.data"
import {
    campaignsIn,
    decisionsIn,
    loyaltyProvider,
    programIn,
    putLead,
    sampleWorld,
    withEntity,
} from "../fixtures/loyalty.memory"
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
    world: MemoryWorld = sampleWorld(),
    memberId: string | null = "staff-1",
    provider: PortProvider = loyaltyProvider(world),
): Promise<ActionResult> => {
    expect(action.execute).toBeDefined()
    return (action.execute ?? notRunnable)(provider, raw, contextOf(memberId))
}

describe("sales.loyalty-save-program", () => {
    it("saves the rules over the saved ones, clamped, and keeps the tiers and the slug", async () => {
        const world = sampleWorld()
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
            world,
        )
        expect(result).toEqual({ ok: true, data: { slug: "hoa-mai-coffee" } })
        expect(programIn(world)).toMatchObject({
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
        expect(programIn(world)?.config.tiers).toEqual(SAMPLE_PROGRAM.config.tiers)
        expect(rowsOf(world, "blocks-core.sales.loyalty-program")).toHaveLength(1)
    })

    it("keeps what a field leaves out", async () => {
        const world = sampleWorld()
        await run(saveProgramAction, { id: "", name: "Hoa Mai Coffee" }, world)
        expect(programIn(world)).toMatchObject({ enabled: true, config: SAMPLE_PROGRAM.config })
    })

    it("makes the slug from the name on the first save, over the starter rules", async () => {
        const world = sampleWorld(null)
        expect(await run(saveProgramAction, { name: "Quan Ca Phe", enabled: true }, world)).toEqual({
            ok: true,
            data: { slug: "quan-ca-phe" },
        })
        expect(programIn(world)).toMatchObject({ enabled: true, version: "1" })
    })

    it("answers a conflict when the engine refuses the save", async () => {
        const world = sampleWorld()
        const refused = withEntity(world, "blocks-core.sales.loyalty-program", {
            upsert: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        expect(await run(saveProgramAction, { name: "Hoa Mai" }, world, "s", refused)).toMatchObject({
            ok: false,
            reason: "conflict",
        })
    })

    it("answers invalid for a blank name", async () => {
        expect(await run(saveProgramAction, { name: "" })).toMatchObject({
            reason: "invalid",
            fields: { name: { key: "renderer.invalid" } },
        })
    })
})

describe("sales.loyalty-sync-members", () => {
    it("makes a customer of a lead with a phone or an email, links the one that is a customer already, and skips the rest", async () => {
        const world = sampleWorld()
        rowsOf(world, "blocks-core.sales.loyalty-member").splice(1, 1)
        putLead(world, "l-9", { contactName: "Hoang Mai", phone: "0977 000 111", email: "mai@example.com" })
        putLead(world, "l-10", { contactName: "Only Email", email: "only@example.com" })
        putLead(world, "l-11", { contactName: "Nothing" })
        putLead(world, "l-12", { contactName: "Bad phone", phone: "12" })
        rowsOf(world, "blocks-core.sales.lead").push({
            id: "l-13",
            workspaceId: "w1",
            version: "1",
            createdAt: SAMPLE_NOW,
            updatedAt: SAMPLE_NOW,
            data: { phone: "0977000222" },
        })
        expect(await run(syncMembersAction, { id: "" }, world)).toEqual({ ok: true, data: { created: 3, linked: 3 } })
        expect(rowsOf(world, "blocks-core.sales.loyalty-member").find((row) => row.data["phone"] === "84977000111")?.data).toMatchObject({
            name: "Hoang Mai",
            email: "mai@example.com",
            contact: "84977000111",
            contactId: "contact-l-9",
        })
        expect(
            rowsOf(world, "blocks-core.sales.loyalty-member").find((row) => row.data["email"] === "only@example.com")?.data,
        ).toMatchObject({ contact: "only@example.com", contactId: "contact-l-10" })
    })

    it("links a customer that has no lead yet, and does nothing the second time", async () => {
        const world = sampleWorld()
        putLead(world, "l-20", { contactName: "Vo Nam", phone: "0933445566" })
        expect(await run(syncMembersAction, { id: "" }, world)).toEqual({ ok: true, data: { created: 0, linked: 1 } })
        expect(rowsOf(world, "blocks-core.sales.loyalty-member").find((candidate) => candidate.id === "m-5")?.data["contactId"]).toBe("contact-l-20")
        expect(await run(syncMembersAction, { id: "" }, world)).toEqual({ ok: true, data: { created: 0, linked: 0 } })
    })

    it("counts nothing for a customer the engine refuses to find or to link", async () => {
        const world = sampleWorld()
        putLead(world, "l-30", { contactName: "Vo Nam", phone: "0933445566" })
        putLead(world, "l-31", { contactName: "Taken", email: "taken@example.com" })
        const refusing = withEntity(world, "blocks-core.sales.loyalty-member", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
            ensure: (match, values) =>
                match === "email"
                    ? Promise.resolve({ ok: false, reason: "taken", constraint: "email_key", refusal: "taken" })
                    : entityApi(world, "blocks-core.sales.loyalty-member").ensure(match, values),
        })
        expect(await run(syncMembersAction, { id: "" }, world, "s", refusing)).toEqual({
            ok: true,
            data: { created: 0, linked: 0 },
        })
    })
})

describe("sales.loyalty-draft-campaign and sales.loyalty-preview-segment", () => {
    it("writes the draft of a promotion in the name of the member who asks", async () => {
        const world = sampleWorld()
        const result = await run(
            draftCampaignAction,
            { name: " Win back ", brief: " 10% off ", tiers: ["bac"], inactiveDays: 60.4, minSpendVnd: 1_000_000 },
            world,
        )
        expect(result).toMatchObject({ ok: true, data: { status: "waiting", recipients: 0 } })
        expect(campaignsIn(world)).toHaveLength(3)
        expect(campaignsIn(world).at(-1)).toMatchObject({
            name: "Win back",
            draft: "10% off",
            createdBy: "staff-1",
            status: "waiting",
            segment: { tiers: ["bac"], inactiveDays: 60, birthdayThisMonth: false, minSpendVnd: 1_000_000 },
        })
    })

    it("names a promotion after nothing when none is given, and the agent signs as NIVO", async () => {
        const world = sampleWorld()
        await run(draftCampaignAction, { birthdayThisMonth: true, inactiveDays: null, minSpendVnd: null }, world, null)
        expect(campaignsIn(world).at(-1)).toMatchObject({
            name: "Promotion",
            draft: "",
            createdBy: "NIVO",
            segment: { tiers: [], birthdayThisMonth: true },
        })
    })

    it("answers a conflict when the engine refuses the draft", async () => {
        const world = sampleWorld()
        const refused = withEntity(world, "blocks-core.sales.loyalty-campaign", {
            insert: () => Promise.resolve({ ok: false, reason: "invalid" }),
        })
        expect(await run(draftCampaignAction, { name: "x" }, world, "s", refused)).toMatchObject({
            ok: false,
            reason: "conflict",
        })
    })

    it("counts the customers a segment holds, how many can be reached and the first names", async () => {
        expect(await run(previewSegmentAction, { tiers: ["dong"] })).toEqual({
            ok: true,
            data: { total: 2, sample: ["L\u00ea Minh Ch\u00e2u", "V\u00f5 Ho\u00e0ng Nam"] },
        })
        expect(await run(previewSegmentAction, {})).toMatchObject({ data: { total: 5 } })
    })

    it("reaches nobody in an empty segment", async () => {
        expect(await run(previewSegmentAction, { tiers: ["none"] })).toEqual({
            ok: true,
            data: { total: 0, sample: [] },
        })
    })
})

describe("sales.loyalty-decide", () => {
    it("approves or rejects a waiting decision, which then no longer waits", async () => {
        const world = sampleWorld()
        expect(await run(decideAction, { id: "d-1", command: "approve" }, world)).toEqual({
            ok: true,
            data: { id: "d-1" },
        })
        expect(decisionsIn(world).map((decision) => decision.id)).toEqual(["d-2"])
        await run(decideAction, { id: "d-2", command: "reject" }, world)
        expect(decisionsIn(world)).toEqual([])
        expect(rowsOf(world, "blocks-core.sales.loyalty-decision").map((row) => row.data["status"])).toEqual(["approved", "rejected"])
    })

    it("refuses as data a decision that is gone or was decided, answers a conflict when the write is stale, and refuses an unknown command", async () => {
        expect(await run(decideAction, { id: "nobody", command: "approve" })).toMatchObject({
            message: { key: "loyalty_refusal_decision_missing" },
        })
        const world = sampleWorld()
        await run(decideAction, { id: "d-1", command: "approve" }, world)
        expect(await run(decideAction, { id: "d-1", command: "reject" }, world)).toMatchObject({
            message: { key: "loyalty_refusal_decision_missing" },
        })
        const stale = withEntity(world, "blocks-core.sales.loyalty-decision", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        expect(await run(decideAction, { id: "d-2", command: "approve" }, world, "s", stale)).toMatchObject({
            reason: "conflict",
        })
        expect(await run(decideAction, { id: "d-1", command: "edit" })).toMatchObject({
            reason: "invalid",
            fields: { command: { key: "renderer.invalid" } },
        })
    })
})
