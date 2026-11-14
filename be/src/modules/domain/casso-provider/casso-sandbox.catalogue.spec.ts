import type { SandboxCase, SandboxInput } from "@modules/domain/provider-sandbox"
import { sandboxAccount, sandboxServiceOf } from "@tests/fixtures/builders/provider-sandbox.builder"
import { cassoCredits } from "@modules/domain/billing/casso.policy"
import {
    CASSO_SANDBOX_CATALOGUE,
    CASSO_SANDBOX_MOVEMENTS_STATE,
    cassoMovementsOf,
    cassoTimeOf,
    unknownCassoReferenceOf,
} from "./casso-sandbox.catalogue"

const ACCOUNT = sandboxAccount({ id: "conn-c", workspaceId: "ws-1", provider: "casso" })
const AT = new Date("2026-11-14T02:15:02.000Z")
const ASKED = { content: "NIVO DH1001", amount: 350_000 }

const inboundOf = (id: string): NonNullable<SandboxCase["inbound"]> => {
    const found = CASSO_SANDBOX_CATALOGUE.cases.find((one) => one.id === id)?.inbound
    if (found === undefined) throw new Error(`no inbound case ${id}`)
    return found
}

/** Sends one case through the real frame (as the one send does) and answers its bodies. */
const send = async (sandbox: ReturnType<typeof sandboxServiceOf>["sandbox"], id: string, input: SandboxInput = ASKED) => {
    const events = await sandbox.inbound(ACCOUNT, id, inboundOf(id), input, AT)
    return events.map((event) => event.body as { error: number; data: Record<string, unknown> })
}

/** The transactions kept in the account's state, read through one frame call (the state is only reachable inside a call). */
const stateOf = async (sandbox: ReturnType<typeof sandboxServiceOf>["sandbox"]): Promise<unknown> =>
    sandbox.call(ACCOUNT, "peek", {}, { answer: (state) => state.read(CASSO_SANDBOX_MOVEMENTS_STATE, "") })

describe("CASSO_SANDBOX_CATALOGUE (owner ruling R62)", () => {
    it("holds exactly CASSO-1..7, all inbound on Casso's real route, each taking { content, amount }, no prefill (Casso has no payment instruction)", () => {
        expect(CASSO_SANDBOX_CATALOGUE.provider).toBe("casso")
        expect(CASSO_SANDBOX_CATALOGUE.cases.map((one) => one.id)).toEqual(["CASSO-1", "CASSO-2", "CASSO-3", "CASSO-4", "CASSO-5", "CASSO-6", "CASSO-7"])
        expect(CASSO_SANDBOX_CATALOGUE.prefill).toBeUndefined()
        for (const one of CASSO_SANDBOX_CATALOGUE.cases) {
            expect(one.inbound?.path("conn-9")).toBe("api/connections/casso/conn-9")
            expect(one.inbound?.inputs.map((field) => [field.name, field.kind])).toEqual([
                ["content", "text"],
                ["amount", "integer"],
            ])
            expect(one.label.toLowerCase()).not.toContain("order")
        }
    })

    it.each([
        ["CASSO-1", 350_000, "NIVO DH1001", 1],
        ["CASSO-2", 349_000, "NIVO DH1001", 1],
        ["CASSO-3", 351_000, "NIVO DH1001", 1],
        ["CASSO-4", 350_000, "", 1],
        ["CASSO-5", -350_000, "NIVO DH1001", 1],
        ["CASSO-6", 350_000, "NIVO DH1001", 2],
        ["CASSO-7", 350_000, "NIVO DH0000", 1],
    ])("%s transforms the inputs into Casso's webhook V2 body (amount %d, content %j, posted %d time(s))", async (id, amount, content, posts) => {
        const { sandbox } = sandboxServiceOf(ACCOUNT)

        const bodies = await send(sandbox, id)

        expect(bodies).toHaveLength(posts)
        expect(bodies[0]).toMatchObject({
            error: 0,
            data: {
                id: 7100001,
                reference: "FT267100001",
                description: content,
                amount,
                accountNumber: "0011004455667",
                bankName: "Vietcombank",
                transactionDateTime: "2026-11-14 09:15:02",
            },
        })
        if (posts === 2) expect(bodies[1]).toEqual(bodies[0])
    })

    it("is read by Casso's real parser: a credit for money in (the event id is casso:<id>), none for money out", async () => {
        const { sandbox } = sandboxServiceOf(ACCOUNT)

        const [paid] = await send(sandbox, "CASSO-1")
        const [out] = await send(sandbox, "CASSO-5")

        expect(cassoCredits(paid ?? {})).toEqual([
            expect.objectContaining({ amount: 350_000, content: "NIVO DH1001", eventId: "casso:7100001", bankRef: "FT267100001" }),
        ])
        expect(cassoCredits(out ?? {})).toEqual([])
    })

    it("runs the account's ids and balance, keeps each ONE transaction (a double post is one), and a new account starts again", async () => {
        const { sandbox } = sandboxServiceOf(ACCOUNT)

        await send(sandbox, "CASSO-1")
        await send(sandbox, "CASSO-6")
        await send(sandbox, "CASSO-5", { content: "hoan tien", amount: 50_000 })

        const kept = cassoMovementsOf(await stateOf(sandbox))
        expect(kept.map((one) => [one.id, one.amount, one.runningBalance])).toEqual([
            [7100001, 350_000, 5_350_000],
            [7100002, 350_000, 5_700_000],
            [7100003, -50_000, 5_650_000],
        ])
        const { sandbox: fresh } = sandboxServiceOf(ACCOUNT)
        expect((await send(fresh, "CASSO-1"))[0]?.data.id).toBe(7100001)
    })

    it("is deterministic: the same inputs at the same moment on a fresh account build the same bytes", async () => {
        const first = await send(sandboxServiceOf(ACCOUNT).sandbox, "CASSO-2")
        const second = await send(sandboxServiceOf(ACCOUNT).sandbox, "CASSO-2")

        expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    })

    it("holds the same fixed 1,000 deviation as SePay's cases, whatever the amount", async () => {
        const { sandbox } = sandboxServiceOf(ACCOUNT)

        const [short] = await send(sandbox, "CASSO-2", { content: "A 1", amount: 10_000 })
        const [over] = await send(sandbox, "CASSO-3", { content: "A 1", amount: 10_000 })

        expect([short?.data.amount, over?.data.amount]).toEqual([9_000, 11_000])
    })

    it("builds the unknown reference (digits -> 0) and Casso's Vietnam-time text deterministically", () => {
        expect(unknownCassoReferenceOf("NIVO DH1001")).toBe("NIVO DH0000")
        expect(unknownCassoReferenceOf("thanh toan")).toBe("thanh toan 000000")
        expect(cassoTimeOf(new Date("2026-11-14T20:00:00.000Z"))).toBe("2026-11-15 03:00:00")
    })
})
