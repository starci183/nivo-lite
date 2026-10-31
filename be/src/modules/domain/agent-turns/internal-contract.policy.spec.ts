import { Test } from "@nestjs/testing"
import { readInternalProposal } from "./internal-contract.policy"

const SUBJECT = Symbol("internal-contract.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readInternalProposal } }],
    }).compile()
    return moduleRef.get<{ readInternalProposal: typeof readInternalProposal }>(SUBJECT)
}

const json = (value: unknown): string => JSON.stringify(value)

const action = {
    action: "send_invoice",
    subject: { type: "invoice", id: "inv-1" },
    leadId: "lead-1",
    fields: { amount_vnd: 4_000_000, note: "late", urgent: true, calm: false, empty: null },
    summary: "Chase the invoice",
}

describe("readInternalProposal > a valid proposal", () => {
    it("reads every part", async () => {
        const subject = await build()

        const proposal = subject.readInternalProposal(
            json({
                reply: " Done. ",
                tasks: [
                    { op: "add", key: "chase-inv-1", title: "Chase invoice 1", nextActionAt: "2026-11-12T03:00:00Z" },
                    { op: "done", key: "old" },
                ],
                actions: [action],
                needsHuman: true,
                reason: "Large amount",
            }),
        )

        expect(proposal).toEqual({
            reply: "Done.",
            tasks: [
                {
                    op: "add",
                    key: "chase-inv-1",
                    title: "Chase invoice 1",
                    nextActionAt: new Date("2026-11-12T03:00:00Z"),
                },
                { op: "done", key: "old" },
            ],
            actions: [
                {
                    action: "send_invoice",
                    subject: { type: "invoice", id: "inv-1" },
                    leadId: "lead-1",
                    fields: { amount_vnd: 4_000_000, note: "late", urgent: "true", calm: "false", empty: null },
                    summary: "Chase the invoice",
                },
            ],
            needsHuman: true,
            reason: "Large amount",
        })
    })

    it("defaults every part an empty answer leaves out", async () => {
        const subject = await build()

        expect(subject.readInternalProposal("{}")).toEqual({
            reply: "",
            tasks: [],
            actions: [],
            needsHuman: false,
            reason: "",
        })
    })

    it("reads the object out of a fenced block or out of words around it", async () => {
        const subject = await build()

        expect(subject.readInternalProposal('```json\n{"reply":"fenced"}\n```').reply).toBe("fenced")
        expect(subject.readInternalProposal('Here you go: {"reply":"wrapped"} thanks').reply).toBe("wrapped")
    })

    it("keeps an action with no subject as a request with no subject", async () => {
        const subject = await build()

        const [first] = subject.readInternalProposal(
            json({ actions: [{ action: "remind", summary: "Remind" }] }),
        ).actions

        expect(first).toEqual({ action: "remind", leadId: null, fields: {}, summary: "Remind" })
        expect(first).not.toHaveProperty("subject")
    })
})

describe("readInternalProposal > what is not a proposal", () => {
    it("takes text that is no JSON as a plain reply, clipped", async () => {
        const subject = await build()

        expect(subject.readInternalProposal("  Just words.  ")).toEqual({
            reply: "Just words.",
            tasks: [],
            actions: [],
            needsHuman: false,
            reason: "",
        })
        expect(subject.readInternalProposal("x".repeat(3000)).reply).toHaveLength(2000)
    })

    it("takes a list, braces that hold no JSON, and a JSON scalar as plain replies", async () => {
        const subject = await build()

        expect(subject.readInternalProposal("[1,2]").reply).toBe("[1,2]")
        expect(subject.readInternalProposal("{not json}").reply).toBe("{not json}")
        expect(subject.readInternalProposal("42").reply).toBe("42")
    })

    it("takes an object that fails the schema as a plain reply with no tasks and no actions", async () => {
        const subject = await build()

        const proposal = subject.readInternalProposal(
            json({ reply: "Kept", tasks: [{ op: "explode", key: "k" }], actions: [action] }),
        )

        expect(proposal).toEqual({ reply: "Kept", tasks: [], actions: [], needsHuman: false, reason: "" })
    })

    it("falls back to the whole text when a failing object has no reply of its own", async () => {
        const subject = await build()
        const text = json({ tasks: "none" })

        expect(subject.readInternalProposal(text).reply).toBe(text)
    })

    it("refuses an action with an unknown subject type, a task with a bad time and an unknown key", async () => {
        const subject = await build()

        expect(
            subject.readInternalProposal(json({ actions: [{ ...action, subject: { type: "planet", id: "1" } }] }))
                .actions,
        ).toEqual([])
        expect(
            subject.readInternalProposal(json({ tasks: [{ op: "add", key: "k", nextActionAt: "tomorrow" }] })).tasks,
        ).toEqual([])
        expect(subject.readInternalProposal(json({ surprise: 1 })).reply).toBe(json({ surprise: 1 }))
    })
})

describe("readInternalProposal > bounds", () => {
    it("cuts a list over its bound and keeps the head", async () => {
        const subject = await build()
        const tasks = Array.from({ length: 14 }, (_, index) => ({ op: "add", key: `k${String(index)}` }))
        const actions = Array.from({ length: 5 }, (_, index) => ({ action: `a${String(index)}` }))

        const proposal = subject.readInternalProposal(json({ tasks, actions }))

        expect(proposal.tasks).toHaveLength(10)
        expect(proposal.tasks[9]?.key).toBe("k9")
        expect(proposal.actions.map((entry) => entry.action)).toEqual(["a0", "a1", "a2"])
    })

    it("takes a reply over 2000 characters as a failing object and clips it", async () => {
        const subject = await build()

        const proposal = subject.readInternalProposal(
            json({ reply: "y".repeat(2500), tasks: [{ op: "add", key: "k" }] }),
        )

        expect(proposal.reply).toHaveLength(2000)
        expect(proposal.tasks).toEqual([])
    })
})
