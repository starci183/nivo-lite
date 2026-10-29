import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { DecisionsService, EvidenceService, WorkPlacementService } from "@modules/domain/decisions"
import { McpGatewayAdminService, McpGatewayService } from "@modules/domain/mcp-gateway"
import { GatewayReceiptsService } from "@modules/domain/mcp-gateway-receipts"
import type { GatewayCallResult } from "@modules/domain/mcp-gateway-receipts"
import { WorkItemsService } from "@modules/domain/work-items"
import { persistOfficeRows } from "../../fixtures/builders/office-chain.builder"
import { API_APP_MODULES } from "../../world/api-app.options"
import { createDedupeRemoteServer } from "../../world/dedupe-remote-server.service"
import { hubNoteProof } from "../../world/inbox-dedupe-proof.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"
import {
    inboxClaims,
    cleanInboxClaim,
    cleanGatewayClaims,
    holdEvidence,
    noteCards,
    failTransaction,
} from "../../world/inbox-database.service"
import { removeAuthUsers, removeWorkspace } from "../../world/proof-accounts.service"
import { grantConnectorTools } from "../../fixtures/builders/mcp-agent.builder"
import { insertProofCard } from "../../fixtures/builders/proof-card.builder"

const world = useTestWorld({ modules: API_APP_MODULES })
const identity = {
    workspaceId: world.id(),
    users: { nam: world.id(), minh: world.id(), ha: world.id(), van: world.id(), lan: world.id() },
    agents: { sales: world.id(), accounting: world.id(), care: world.id() },
}
const WS = identity.workspaceId
const server = createDedupeRemoteServer()
const owner = { principalId: identity.users.nam, workspaceId: WS }
const caller = { workspaceId: WS, agentId: identity.agents.sales, conversationId: null, workItemId: null }

const cleanupClaim = (source: string, key: string): void => {
    world.cleanup(async () => {
        await cleanInboxClaim(world.db.primary, source, key)
    })
}

const holdKey = (itemId: string, note: string): string =>
    createHash("sha256")
        .update(JSON.stringify([WS, itemId, identity.users.nam, note]))
        .digest("hex")

const waitingItem = async () => {
    const items = world.resolve(WorkItemsService)
    const proposal = { summary: "Inbox dedupe regression", fields: { original: "preserved" } }
    const item = await items.insert({
        workspaceId: WS,
        chainId: null,
        depth: 0,
        department: "sales",
        action: "give_discount",
        subjectType: "lead",
        subjectId: null,
        leadId: null,
        inboundEventId: null,
        parentId: null,
        dedupeKey: world.key(world.id()),
        proposal,
        installationId: null,
    })
    assert(item !== null)
    return items.markWaiting(item.id, {
        reason: "missing_data",
        reasons: ["missing_data"],
        missing: ["receipt"],
        proposal,
        executionId: null,
    })
}

beforeAll(async () => {
    world.cleanup(async () => {
        await cleanGatewayClaims(world.db.primary, WS)
        await removeWorkspace(world.db.primary, WS)
        await removeAuthUsers(world.db.primary, Object.values(identity.users))
    })
    const credential = await world.db.primary.transaction(async (tx) => {
        await persistOfficeRows(tx, identity)
        await grantConnectorTools(tx, WS, identity.agents.sales, "hakuen.*")
        return randomBytes(32).toString("hex")
    })
    await server.listen()
    await world.resolve(McpGatewayAdminService).registerRemote(owner, {
        key: "hakuen",
        name: "Local HAKUEN dedupe regression",
        url: server.url,
        credential,
        contractVersion: "hakuen-mcp@1",
    })
    await expect(world.resolve(McpGatewayAdminService).approveCatalog(owner, "hakuen")).resolves.toBe(1)
})

afterAll(() => server.close())

describe("durable hold dedupe on the migrated local database", () => {
    it("commits one hold and one evidence line for 24 concurrent normalised retries", async () => {
        const item = await waitingItem()
        const key = holdKey(item.id, "Need a receipt")
        cleanupClaim("work.hold", key)
        const holds = world.resolve(WorkPlacementService)
        const results = await Promise.all(
            Array.from({ length: 24 }, (_, index) =>
                holds.hold(identity.users.nam, WS, {
                    workItemId: item.id,
                    note: index % 2 === 0 ? "Need a receipt" : "  Need\n a receipt ",
                    locale: "en",
                }),
            ),
        )
        expect(results).toHaveLength(24)
        expect(results.every((held) => held.status === "waiting_decision")).toBe(true)
        expect(await holdEvidence(world.db.primary, WS, item.id)).toEqual([{ evidence: "Need a receipt" }])
        expect(await inboxClaims(world.db.primary, "work.hold", key)).toHaveLength(1)
    })

    it("rolls a hold and claim back when its evidence SQL fails, then accepts the same retry", async () => {
        const item = await waitingItem()
        const key = holdKey(item.id, "Retry this hold")
        cleanupClaim("work.hold", key)
        const request = { workItemId: item.id, note: "Retry this hold", locale: "en" as const }
        const evidence = jest
            .spyOn(world.resolve(EvidenceService), "log")
            .mockImplementationOnce(async (_ctx, _entry, tx) => {
                assert(tx !== undefined)
                await failTransaction(tx)
            })
        try {
            await expect(
                world.resolve(WorkPlacementService).hold(identity.users.nam, WS, request),
            ).rejects.toMatchObject({
                code: "22012",
            })
            expect(evidence).toHaveBeenCalledTimes(1)
        } finally {
            evidence.mockRestore()
        }
        const original = await world.resolve(DecisionsService).getWorkItem(identity.users.nam, WS, item.id)
        expect(original.proposal).toEqual(item.proposal)
        expect(await inboxClaims(world.db.primary, "work.hold", key)).toHaveLength(0)
        expect(await holdEvidence(world.db.primary, WS, item.id)).toHaveLength(0)
        await world.resolve(WorkPlacementService).hold(identity.users.nam, WS, request)
        expect(await holdEvidence(world.db.primary, WS, item.id)).toEqual([{ evidence: "Retry this hold" }])
    })
})

describe("durable HAKUEN write dedupe on the migrated local database", () => {
    it("runs one local HAKUEN write for concurrent gateway retries, then replays the completed answer", async () => {
        const gateway = world.resolve(McpGatewayService)
        const keyed = { ...caller, opKey: world.key("hakuen-concurrent") }
        const before = server.calls.length
        const results = await Promise.all(
            Array.from({ length: 24 }, () => gateway.call(keyed, "hakuen.booking.hold", { roomType: "deluxe" })),
        )
        expect(server.calls).toHaveLength(before + 1)
        const completed: GatewayCallResult = { ok: true, value: { holdId: `hold-${String(before + 1)}` } }
        const pending: GatewayCallResult = { ok: false, code: "unknown_outcome", detail: "operation_pending" }
        expect(results).toContainEqual(completed)
        for (const result of results) expect([completed, pending]).toContainEqual(result)
        await expect(gateway.call(keyed, "hakuen.booking.hold", { roomType: "deluxe" })).resolves.toEqual(completed)
        expect(server.calls).toHaveLength(before + 1)
        expect(server.calls[before]?.idempotencyKey).toMatch(/^nivo:[a-f0-9]{64}$/u)
    })

    it("rolls a HAKUEN claim back when sealing intent fails before the connector call", async () => {
        const gateway = world.resolve(McpGatewayService)
        const keyed = { ...caller, opKey: world.key("hakuen-rollback") }
        const before = server.calls.length
        const failure = new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
        const seal = jest.spyOn(world.resolve(ConnectionSecretsService), "seal").mockImplementationOnce(() => {
            throw failure
        })
        try {
            await expect(gateway.call(keyed, "hakuen.booking.hold", { roomType: "suite" })).rejects.toBe(failure)
        } finally {
            seal.mockRestore()
        }
        expect(server.calls).toHaveLength(before)
        await expect(gateway.call(keyed, "hakuen.booking.hold", { roomType: "suite" })).resolves.toMatchObject({
            ok: true,
        })
        expect(server.calls).toHaveLength(before + 1)
    })

    it("keeps pending intent after an operation crashes and refuses to issue that operation again", async () => {
        const receipts = world.resolve(GatewayReceiptsService)
        const key = world.key("hakuen-crash")
        const failure = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        const operation = jest.fn<Promise<GatewayCallResult>, []>().mockRejectedValue(failure)
        await expect(receipts.run(WS, key, operation)).rejects.toBe(failure)
        await expect(receipts.run(WS, key, operation)).resolves.toEqual({
            ok: false,
            code: "unknown_outcome",
            detail: "operation_pending",
        })
        expect(operation).toHaveBeenCalledTimes(1)
    })
})

describe("durable OpenClaw Hub-note dedupe on the migrated local database", () => {
    it("posts one card in the OpenClaw Hub-note sink for 24 concurrent calls of one operation", async () => {
        const notes = hubNoteProof(world, WS)
        const key = world.key("openclaw-concurrent")
        const title = world.key("one-action-card")
        cleanupClaim("hub.note", JSON.stringify([WS, key]))
        await Promise.all(Array.from({ length: 24 }, () => notes.postOnce(title, identity.agents.sales, key)))
        expect(await noteCards(world.db.primary, WS, title)).toHaveLength(1)
        expect(await inboxClaims(world.db.primary, "hub.note", JSON.stringify([WS, key]))).toHaveLength(1)
    })

    it("rolls the OpenClaw Hub-note sink's claim back on a database foreign-key failure and accepts the retry", async () => {
        const notes = hubNoteProof(world, WS)
        const key = world.key("openclaw-rollback")
        const title = world.key("retry-action-card")
        cleanupClaim("hub.note", JSON.stringify([WS, key]))
        await expect(notes.postOnce(title, world.id(), key)).rejects.toMatchObject({
            code: "23503",
        })
        expect(await noteCards(world.db.primary, WS, title)).toHaveLength(0)
        expect(await inboxClaims(world.db.primary, "hub.note", JSON.stringify([WS, key]))).toHaveLength(0)
        await notes.postOnce(title, identity.agents.sales, key)
        expect(await noteCards(world.db.primary, WS, title)).toHaveLength(1)
    })
})

describe("Hub card validation on the migrated local database", () => {
    it.each([
        "draft_post",
        "video_ready",
        "approval_request",
        "schedule_confirmed",
        "weekly_report",
        "booking_held",
        "daily_summary",
        "handoff_note",
        "exception",
        "action_done",
    ])("stores the v1 %s card without changing its payload", async (type) => {
        const card = { v: 1, type, title: world.key("valid-card") }
        await expect(insertProofCard(world.db.primary, WS, card)).resolves.toEqual([{ card }])
    })

    it("retains ordinary message lines without a card", async () => {
        await expect(insertProofCard(world.db.primary, WS, null)).resolves.toEqual([{ card: null }])
    })

    it.each([
        { name: "an unsupported type", card: { v: 1, type: "unsupported", title: "Invalid card" } },
        { name: "a version 2 payload", card: { v: 2, type: "action_done", title: "Invalid card" } },
        { name: "a non-object payload", card: [{ v: 1, type: "action_done", title: "Invalid card" }] },
        {
            name: "a payload exceeding 65536 UTF-8 bytes",
            card: { v: 1, type: "action_done", title: "\u00e9".repeat(32768) },
        },
    ])("rejects $name with the card check constraint", async ({ card }) => {
        await expect(insertProofCard(world.db.primary, WS, card)).rejects.toMatchObject({
            code: "23514",
            constraint: "messages_card_check",
        })
    })
})
