import { entityProblems, manifestOf } from "@nivo-lite/agent-sdk/entity"
import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { FLOW_F_ENTITIES } from "./flow-f.entities"

const catalog = new Map<string, AnyEntityDefinition>(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

const entityNamed = (name: string): AnyEntityDefinition | undefined => catalog.get(name)

describe("flow F entity declarations", () => {
    it("declares the thirteen entities once each", () => {
        expect(FLOW_F_ENTITIES.map((entity) => entity.name)).toEqual([
            "sales.lead",
            "sales.order",
            "chat.conversation",
            "chat.message",
            "payment.transaction",
            "payment.claim",
            "accounting.invoice",
            "accounting.adjustment",
            "accounting.book-entry",
            "agent.turn",
            "agent.run",
            "agent.run-step",
            "agent.node-effect",
        ])
        expect(catalog.size).toBe(FLOW_F_ENTITIES.length)
        expect(new Set(FLOW_F_ENTITIES.map((entity) => entity.dataKind)).size).toBe(FLOW_F_ENTITIES.length)
    })

    it("has no entity problem across the whole catalog", () => {
        for (const entity of FLOW_F_ENTITIES) expect(entityProblems(entity, catalog)).toEqual([])
    })

    it("keeps the graph node kinds of today", () => {
        expect(Object.fromEntries(FLOW_F_ENTITIES.map((entity) => [entity.name, entity.dataKind]))).toMatchObject({
            "sales.lead": "sales-lead",
            "sales.order": "order",
            "chat.conversation": "conversation",
            "chat.message": "message",
            "payment.transaction": "bank-transaction",
            "payment.claim": "payment-claim",
        })
    })

    it("mints the order number per day as DH-yyyymmdd-nnnn", () => {
        expect(entityNamed("sales.order")?.fields["orderNo"]).toMatchObject({
            kind: "sequence",
            format: "DH-{yyyy}{mm}{dd}-{n:4}",
            resets: "day",
        })
    })

    it("finds a lead by phone or email and keeps each unique per workspace", () => {
        const lead = entityNamed("sales.lead")
        expect(lead?.matchKeys).toEqual([
            { name: "phone", on: ["phone"] },
            { name: "email", on: ["email"] },
        ])
        expect(lead?.constraints?.map((constraint) => constraint.name)).toEqual(["phone_key", "email_key"])
        expect(lead?.fields["stage"]?.of).toEqual(["new", "qualified", "proposal", "won", "lost"])
    })

    it("links a message to its conversation, required", () => {
        expect(entityNamed("chat.message")?.relations?.["conversation"]).toEqual({
            kind: "toOne",
            target: "chat.conversation",
            required: true,
            onDelete: "cascade",
        })
    })

    it("lets one transaction settle at most one claim", () => {
        const unique = entityNamed("payment.claim")?.constraints?.find(
            (constraint) => constraint.name === "settled_transaction_key",
        )
        expect(unique).toMatchObject({
            kind: "unique",
            on: ["settledTransactionId"],
            refusal: "transaction-already-settled",
        })
    })

    it("projects the books from transactions, invoices and adjustments", () => {
        const book = entityNamed("accounting.book-entry")
        expect(book?.projection?.sources).toEqual([
            "payment.transaction",
            "accounting.invoice",
            "accounting.adjustment",
        ])
        expect(book?.view).toBe(true)
    })

    it("keeps one synced turn per session index", () => {
        expect(entityNamed("agent.turn")?.constraints).toEqual([
            {
                kind: "unique",
                name: "session_turn_key",
                on: ["sessionKey", "turnIndex"],
                refusal: "turn-already-synced",
            },
        ])
    })

    it("opens one run per wake and planning flag, and one step per run and step key", () => {
        expect(entityNamed("agent.run")?.constraints).toContainEqual(
            expect.objectContaining({ kind: "unique", on: ["wakeId", "planning"], refusal: "run-already-open" }),
        )
        expect(entityNamed("agent.run-step")?.constraints).toContainEqual(
            expect.objectContaining({ kind: "unique", on: ["runId", "stepKey"], refusal: "step-already-written" }),
        )
        expect(entityNamed("agent.run-step")?.relations?.["run"]).toMatchObject({ kind: "toOne", required: true })
    })

    it("keeps the effect ledger unique per key and never deletable", () => {
        const ledger = entityNamed("agent.node-effect")
        expect(ledger?.constraints).toContainEqual(expect.objectContaining({ on: ["effectKey"] }))
        expect(ledger?.deletable).toBeUndefined()
    })

    it("parses the step effect and door call shapes", () => {
        const step = entityNamed("agent.run-step")
        expect(step?.fields["effect"]?.shape?.parse({ kind: "compensable", compensation: "undo" })).toEqual({
            kind: "compensable",
            compensation: "undo",
        })
        expect(step?.fields["effect"]?.shape?.safeParse({ kind: "other" }).success).toBe(false)
        expect(
            step?.fields["doorCalls"]?.shape?.parse({ calls: [{ tool: "chat.send", ok: true, effectKey: "k" }] }),
        ).toEqual({ calls: [{ tool: "chat.send", ok: true, effectKey: "k" }] })
    })

    it("indexes the messages of a conversation and keeps one transaction and one invoice per order", () => {
        expect(entityNamed("chat.message")?.indexes).toEqual([
            { name: "conversation_sent", on: ["conversationId", { desc: "sentAt" }, { desc: "id" }] },
            { name: "channel_ref", on: ["channelRef", "id"] },
            { name: "reply_of", on: ["conversationId", "inReplyTo", { desc: "sentAt" }, { desc: "id" }] },
            { name: "role_recent", on: ["role", { desc: "sentAt" }, { desc: "id" }] },
        ])
        for (const name of ["payment.transaction", "accounting.invoice"]) {
            expect(entityNamed(name)?.constraints).toContainEqual(
                expect.objectContaining({
                    kind: "unique",
                    name: "order_key",
                    on: ["orderId"],
                    where: { op: "notNull", field: "orderId" },
                }),
            )
        }
    })

    it("numbers invoices per month as HD-yyyymm-nnnn", () => {
        expect(entityNamed("accounting.invoice")?.fields["invoiceNo"]).toMatchObject({
            kind: "sequence",
            format: "HD-{yyyy}{mm}-{n:4}",
            resets: "month",
        })
    })

    it("parses the declared jsonb shapes", () => {
        const names = entityNamed("payment.claim")?.fields["names"]?.shape
        const calls = entityNamed("agent.turn")?.fields["toolCalls"]?.shape
        expect(names?.parse({ values: ["Dinh"] })).toEqual({ values: ["Dinh"] })
        expect(calls?.parse({ calls: [{ name: "chat.send", argsJson: "{}" }] })).toEqual({
            calls: [{ name: "chat.send", argsJson: "{}" }],
        })
    })

    describe("the entities manifest", () => {
        it("lists every entity with its partition, sorted by entity", () => {
            const manifest = manifestOf(FLOW_F_ENTITIES)
            const names = manifest.entities.map((entry) => entry.entity)
            expect(manifest.version).toBe(1)
            expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)))
            for (const entry of manifest.entities)
                expect(entry.partition).toBe(`records_${entry.entity.replaceAll(/[.-]/g, "_")}`)
        })

        it("is stable: the same declarations in another order give the same manifest", () => {
            expect(manifestOf([...FLOW_F_ENTITIES].reverse())).toEqual(manifestOf(FLOW_F_ENTITIES))
        })

        it("names the indexes and checks the drift compares", () => {
            const lead = manifestOf(FLOW_F_ENTITIES).entities.find((entry) => entry.entity === "sales.lead")
            expect(lead?.partition).toBe("records_sales_lead")
            expect(lead?.indexes).toEqual(
                expect.arrayContaining(["records_sales_lead_recent", "records_sales_lead_phone_key"]),
            )
        })
    })
})
