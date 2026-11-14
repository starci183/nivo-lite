import { entityProblems, manifestOf } from "@nivo-lite/agent-sdk/entity"
import type { AnyEntityDefinition } from "@nivo-lite/agent-sdk/entity"

import { FLOW_F_ENTITIES } from "./flow-f.entities"

const catalog = new Map<string, AnyEntityDefinition>(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

const entityNamed = (name: string): AnyEntityDefinition | undefined => catalog.get(name)

describe("flow F entity declarations", () => {
    it("declares the thirty-two entities once each", () => {
        expect(FLOW_F_ENTITIES.map((entity) => entity.name)).toEqual([
            "blocks-core.sales.lead",
            "blocks-core.sales.order",
            "blocks-core.sales.settings",
            "blocks-core.chatbot.chat",
            "blocks-core.chatbot.note",
            "blocks-core.chatbot.reply",
            "blocks-core.chatbot.settings",
            "blocks-core.sales.transaction",
            "blocks-core.sales.claim",
            "blocks-core.sales.invoice",
            "blocks-core.sales.ledger-adjustment",
            "blocks-core.sales.ledger-entry",
            "blocks-core.sales.ledger-question",
            "blocks-core.sales.ledger-settings",
            "blocks-core.sales.loyalty-member",
            "blocks-core.sales.loyalty-ledger-entry",
            "blocks-core.sales.loyalty-reward",
            "blocks-core.sales.loyalty-program",
            "blocks-core.sales.loyalty-campaign",
            "blocks-core.sales.loyalty-decision",
            "blocks-core.booking.service",
            "blocks-core.booking.resource",
            "blocks-core.booking.hours",
            "blocks-core.booking.booking",
            "blocks-core.booking.settings",
            "blocks-core.video.project",
            "blocks-core.video.render",
            "blocks-core.video.brand-kit",
            "blocks-core.hiring.job",
            "blocks-core.hiring.candidate",
            "blocks-core.content.brand",
            "blocks-core.content.post",
        ])
        expect(catalog.size).toBe(FLOW_F_ENTITIES.length)
        expect(new Set(FLOW_F_ENTITIES.map((entity) => entity.dataKind)).size).toBe(FLOW_F_ENTITIES.length)
    })

    it("has no entity problem across the whole catalog", () => {
        for (const entity of FLOW_F_ENTITIES) expect(entityProblems(entity, catalog)).toEqual([])
    })

    it("sorts the loyalty members by the last purchase with those who never bought last", () => {
        const member = entityNamed("blocks-core.sales.loyalty-member")
        expect(member?.fields["lastActivityAt"]).toMatchObject({
            kind: "timestamptz",
            nullable: false,
            default: { literal: "1970-01-01T00:00:00.000Z" },
        })
        expect(member?.indexes?.find((index) => index.name === "recent")?.on).toEqual([
            { desc: "lastActivityAt" },
            { desc: "id" },
        ])
    })

    it("keeps the graph node kinds of today", () => {
        expect(Object.fromEntries(FLOW_F_ENTITIES.map((entity) => [entity.name, entity.dataKind]))).toMatchObject({
            "blocks-core.sales.lead": "sales-lead",
            "blocks-core.sales.order": "order",
            "blocks-core.chatbot.chat": "conversation",
            "blocks-core.chatbot.reply": "chat-reply",
            "blocks-core.chatbot.settings": "chatbot-settings",
            "blocks-core.sales.transaction": "bank-transaction",
            "blocks-core.sales.claim": "payment-claim",
            "blocks-core.sales.loyalty-member": "loyalty-member",
            "blocks-core.sales.loyalty-ledger-entry": "loyalty-ledger",
            "blocks-core.sales.loyalty-reward": "loyalty-reward",
            "blocks-core.sales.loyalty-program": "loyalty-program",
            "blocks-core.sales.loyalty-campaign": "loyalty-campaign",
            "blocks-core.sales.loyalty-decision": "loyalty-decision",
        })
    })

    it("keeps one video brand kit per workspace, the clips of a render as a list of file references and its narration as one", () => {
        expect(entityNamed("blocks-core.video.brand-kit")?.constraints).toContainEqual(
            expect.objectContaining({ kind: "unique", on: ["key"], refusal: "brand-kit-exists" }),
        )
        expect(entityNamed("blocks-core.video.render")?.fields["clips"]).toMatchObject({ kind: "file", many: true, max: 12 })
        expect(entityNamed("blocks-core.video.render")?.fields["voice"]).toMatchObject({ kind: "file", nullable: true })
        expect(entityNamed("blocks-core.video.render")?.fields["video"]).toBeUndefined()
        expect(entityNamed("blocks-core.video.project")?.fields["script"]?.shape?.safeParse({ scenes: [{ role: "intro" }] }).success).toBe(
            false,
        )
    })

    it("mints the order number per day as DH-yyyymmdd-nnnn", () => {
        expect(entityNamed("blocks-core.sales.order")?.fields["orderNo"]).toMatchObject({
            kind: "sequence",
            format: "DH-{yyyy}{mm}{dd}-{n:4}",
            resets: "day",
        })
    })

    it("finds a lead by phone or email and keeps each unique per workspace", () => {
        const lead = entityNamed("blocks-core.sales.lead")
        expect(lead?.matchKeys).toEqual([
            { name: "phone", on: ["phone"] },
            { name: "email", on: ["email"] },
        ])
        expect(lead?.constraints?.map((constraint) => constraint.name)).toEqual(["contact_key", "phone_key", "email_key"])
        expect(lead?.fields["stage"]?.of).toEqual(["new", "qualified", "proposal", "won", "lost"])
    })

    // Design change (owner ruling R26): the chatbot's line record `blocks-core.chatbot.message` is gone (the lines are the engine's); its
    // note and the reply work item a member typed hang on the conversation instead.
    it("links a note and a reply to their conversation, required", () => {
        expect(entityNamed("blocks-core.chatbot.note")?.relations?.["conversation"]).toEqual({
            kind: "toOne",
            target: "blocks-core.chatbot.chat",
            required: true,
            onDelete: "cascade",
        })
        expect(entityNamed("blocks-core.chatbot.reply")?.relations?.["conversation"]).toEqual({
            kind: "toOne",
            target: "blocks-core.chatbot.chat",
            required: true,
            onDelete: "cascade",
        })
    })

    it("lets one transaction settle at most one claim", () => {
        const unique = entityNamed("blocks-core.sales.claim")?.constraints?.find(
            (constraint) => constraint.name === "settled_transaction_key",
        )
        expect(unique).toMatchObject({
            kind: "unique",
            on: ["settledTransactionId"],
            refusal: "transaction-already-settled",
        })
    })

    it("projects the books from transactions, invoices and adjustments", () => {
        const book = entityNamed("blocks-core.sales.ledger-entry")
        expect(book?.projection?.sources).toEqual([
            "blocks-core.sales.transaction",
            "blocks-core.sales.invoice",
            "blocks-core.sales.ledger-adjustment",
        ])
        expect(book?.view).toBe(true)
    })

    it("indexes the notes of a conversation, keeps a reply once per send key, and one transaction and one invoice per order", () => {
        expect(entityNamed("blocks-core.chatbot.note")?.indexes).toEqual([
            { name: "conversation_at", on: ["conversationId", { desc: "at" }, { desc: "id" }] },
        ])
        expect(entityNamed("blocks-core.chatbot.reply")?.constraints).toEqual([
            { kind: "unique", name: "send_key", on: ["key"], refusal: "reply-exists" },
        ])
        expect(entityNamed("blocks-core.sales.invoice")?.constraints).toContainEqual(
            expect.objectContaining({
                kind: "unique",
                name: "order_key",
                on: ["orderId"],
                where: { op: "notNull", field: "orderId" },
            }),
        )
        // D-MX-3: an order may be paid by several credits (a customer who pays in parts); the order's credits are read by index.
        expect(entityNamed("blocks-core.sales.transaction")?.constraints).not.toContainEqual(
            expect.objectContaining({ name: "order_key" }),
        )
        expect(entityNamed("blocks-core.sales.transaction")?.indexes).toContainEqual({ name: "order", on: ["orderId", { desc: "id" }] })
    })

    it("numbers invoices per month as HD-yyyymm-nnnn", () => {
        expect(entityNamed("blocks-core.sales.invoice")?.fields["invoiceNo"]).toMatchObject({
            kind: "sequence",
            format: "HD-{yyyy}{mm}-{n:4}",
            resets: "month",
        })
    })

    it("parses the declared jsonb shapes", () => {
        const names = entityNamed("blocks-core.sales.claim")?.fields["names"]?.shape
        expect(names?.parse({ values: ["Dinh"] })).toEqual({ values: ["Dinh"] })
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
            const lead = manifestOf(FLOW_F_ENTITIES).entities.find((entry) => entry.entity === "blocks-core.sales.lead")
            expect(lead?.partition).toBe("records_blocks_core_sales_lead")
            expect(lead?.indexes).toEqual(
                expect.arrayContaining(["records_blocks_core_sales_lead_recent", "records_blocks_core_sales_lead_phone_key"]),
            )
        })
    })
})
