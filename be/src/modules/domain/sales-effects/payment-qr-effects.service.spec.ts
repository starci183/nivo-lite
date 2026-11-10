import assert from "node:assert/strict"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { WorkspacePaymentAccountService } from "@modules/domain/channel-connections"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import type { NodeDataPort, NodeEffectExecutor, NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { PaymentInstructionRegistryService } from "@modules/domain/provider-registry"
import type { PaymentInstructionPort } from "@modules/domain/provider-registry"
import { PaymentQrEffectsService } from "./payment-qr-effects.service"
import { payableOrderOf } from "./payment-qr.policy"

const QR = "https://qr.example/DH202611100001.png"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "en",
}
const CALL: EffectCall = { key: "run-1:qr:0", dedupeKey: null }

const ORDER: NodeRow = {
    orderNo: "DH-20261110-0001",
    amountVnd: 300_000,
    status: "confirmed",
    items: { lines: [{ name: "tea boxes", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] },
    note: "25 Nguyen Hue",
}

/** The customer-send executor of the chat, which also takes a message the back end composed. */
interface Sender extends NodeEffectExecutor {
    composed: jest.Mock<Promise<SubjectRef>, [NodeTurn, Record<string, unknown>, EffectCall]>
}

/** The two payment accounts of the shop: MB (k1) and VCB (k2). */
const ACCOUNTS = {
    k1: { accountNumber: "525209999", bankCode: "MBBank", holder: "NGUYEN VAN A", provider: "sepay", connectionId: "k1" },
    k2: { accountNumber: "007100123", bankCode: "VCB", holder: "NGUYEN VAN A", provider: "sepay", connectionId: "k2" },
} as const

const build = async (
    options: { order?: NodeRow | null; account?: boolean; composing?: boolean; defaultAccount?: "k1" | "k2" | null } = {},
) => {
    const api = {
        get: jest.fn().mockResolvedValue({ id: "o1", version: "1", data: { orderNo: "DH-20261110-0001" } }),
        update: jest.fn().mockResolvedValue({ ok: true }),
    }
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation(((_workspaceId: string, work: (tx: unknown) => unknown) => work({})) as never)
    const ports = mock<EntityPortsService>()
    ports.entitiesApi.mockReturnValue(api as never)
    const abilities = mock<ProviderAbilitiesService>()
    abilities.defaultAccountOf.mockResolvedValue(options.defaultAccount === undefined ? "k1" : options.defaultAccount)
    const registry = mock<GraphNodeRegistryService>()
    const accounts = mock<WorkspacePaymentAccountService>()
    const providers = mock<PaymentInstructionRegistryService>()
    const order = options.order === undefined ? ORDER : options.order
    registry.portOf.mockImplementation((kind) =>
        mock<NodeDataPort>({
            kind,
            read: jest.fn().mockResolvedValue(kind === "order" ? (order === null ? [] : [order]) : []),
        }),
    )
    const sender: Sender = {
        effect: "customer.message.send",
        execute: jest.fn().mockResolvedValue({ kind: "message", id: "m-plain" }),
        composed: jest.fn().mockResolvedValue({ kind: "message", id: "m1" }),
    }
    const plain: NodeEffectExecutor = { effect: sender.effect, execute: sender.execute }
    const rematch = mock<NodeEffectExecutor>({ execute: jest.fn().mockResolvedValue({ kind: "order", id: "o1" }) })
    const schedule = mock<NodeEffectExecutor>({ execute: jest.fn().mockResolvedValue({ kind: "agent-task", id: "t" }) })
    registry.executorOf.mockImplementation((effect) =>
        effect === "payment.credit.rematch" ? rematch : options.composing === false ? plain : sender,
    )
    registry.optionalExecutorOf.mockReturnValue(schedule)
    accounts.accountOfConnection.mockImplementation((_workspaceId, connectionId) =>
        Promise.resolve(options.account === false ? null : (ACCOUNTS[connectionId as keyof typeof ACCOUNTS] ?? null)),
    )
    providers.of.mockReturnValue(
        mock<PaymentInstructionPort>({ provider: "sepay", qrUrl: jest.fn().mockReturnValue(QR) }),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentQrEffectsService,
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: WorkspacePaymentAccountService, useValue: accounts },
            { provide: PaymentInstructionRegistryService, useValue: providers },
            { provide: ProviderAbilitiesService, useValue: abilities },
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityPortsService, useValue: ports },
        ],
    }).compile()
    moduleRef.get(PaymentQrEffectsService).onModuleInit()
    const executor = registry.addExecutor.mock.calls[0]?.[0]
    assert(executor !== undefined, "no executor was registered")
    return { executor, registry, sender, rematch, schedule, providers, abilities, accounts, api }
}

describe("PaymentQrEffectsService on a shop with two payment accounts", () => {
    it("draws the QR on the default receiving account the gateway names, never the first feed, and records which one", async () => {
        const { executor, providers, abilities, accounts, api } = await build({ defaultAccount: "k2" })

        const fact = await executor.execute(TURN, { orderId: "o1" }, CALL)

        expect(abilities.defaultAccountOf).toHaveBeenCalledWith("ws-1", "payment")
        expect(accounts.accountOfConnection).toHaveBeenCalledWith("ws-1", "k2")
        expect(providers.of("sepay")?.qrUrl).toHaveBeenCalledWith(
            expect.objectContaining({ accountNumber: "007100123" }),
            expect.anything(),
        )
        expect(fact.facts).toMatchObject({ connectionId: "k2", accountLast4: "0123" })
        expect(api.update).toHaveBeenCalledWith("sales.order", "o1", "1", { qrConnectionId: "k2" })
    })

    it("refuses with no_default_account and sends nothing when the shop named no default receiving account", async () => {
        const { executor, sender, accounts } = await build({ defaultAccount: null })

        await expect(executor.execute(TURN, { orderId: "o1" }, CALL)).resolves.toMatchObject({
            id: "no_default_account",
            facts: { orderNo: "DH-20261110-0001", amountVnd: 300_000 },
        })
        expect(accounts.accountOfConnection).not.toHaveBeenCalled()
        expect(sender.composed).not.toHaveBeenCalled()
    })
})

describe("PaymentQrEffectsService", () => {
    it("registers the payment.qr-create executor", async () => {
        const { executor } = await build()
        expect(executor.effect).toBe("payment.qr.create")
    })

    it("sends the payment details of the order with the QR and its card, from the records, and answers them as facts", async () => {
        const { executor, sender, providers } = await build()

        await expect(executor.execute(TURN, { orderId: "o1" }, CALL)).resolves.toEqual({
            kind: "message",
            id: "m1",
            facts: {
                orderNo: "DH-20261110-0001",
                amountVnd: 300_000,
                transferContent: "DH202611100001",
                qrUrl: QR,
                connectionId: "k1",
                bankName: "MB Bank",
                accountLast4: "9999",
            },
        })

        expect(providers.of("sepay")?.qrUrl).toHaveBeenCalledWith(
            expect.objectContaining({ accountNumber: "525209999" }),
            {
                orderNo: "DH-20261110-0001",
                amountVnd: 300_000,
                transferContent: "DH202611100001",
            },
        )
        const [turn, send, call] = sender.composed.mock.calls[0] ?? []
        expect(turn).toBe(TURN)
        expect(send).toMatchObject({
            conversationId: "conv-1",
            images: [{ url: QR, caption: "DH202611100001" }],
            order: { orderNo: "DH-20261110-0001", address: "25 Nguyen Hue", paid: false },
        })
        expect(send?.text).toBe(
            [
                "Your order is confirmed: 2 x tea boxes · 300.000 VND.",
                "Please transfer with these details:",
                "Bank: MB Bank",
                "Account number: 525209999",
                "Account holder: NGUYEN VAN A",
                "Transfer content (type exactly): DH202611100001",
                `Or scan the QR code: ${QR}`,
                "Once you have transferred, just message us here.",
            ].join("\n"),
        )
        expect(call).toEqual({ key: "run-1:qr:0:send", dedupeKey: "payment-request:o1" })
    })

    it("looks again for a credit that came before the code, and arms no reminder: the step does that from the policy", async () => {
        const { executor, rematch, schedule } = await build()
        await executor.execute(TURN, { orderId: "o1" }, CALL)

        expect(rematch.execute).toHaveBeenCalledWith(
            TURN,
            { orderId: "o1" },
            { key: "run-1:qr:0:rematch", dedupeKey: "payment-rematch:o1" },
        )
        expect(schedule.execute).not.toHaveBeenCalled()
    })

    it("takes the order id alone: an amount or an account typed into the payload changes nothing", async () => {
        const { executor, sender } = await build()
        await executor.execute(TURN, { orderId: "o1", amountVnd: 1, accountNumber: "000" }, CALL)
        expect(sender.composed.mock.calls[0]?.[1]?.text).toContain("300.000 VND")
        expect(sender.composed.mock.calls[0]?.[1]?.text).toContain("525209999")
    })

    it.each([
        ["order_missing", { order: null }, {}],
        [
            "order_not_payable",
            { order: { ...ORDER, status: "draft" } },
            { orderNo: "DH-20261110-0001", status: "draft", amountVnd: 300_000 },
        ],
        [
            "order_not_payable",
            { order: { ...ORDER, amountVnd: null } },
            { orderNo: "DH-20261110-0001", status: "confirmed" },
        ],
        ["no_payment_account", { account: false }, { orderNo: "DH-20261110-0001", amountVnd: 300_000, connectionId: "k1" }],
    ])("answers %s as a refusal fact and sends nothing", async (reason, options, facts) => {
        const { executor, sender, rematch, schedule } = await build(options)
        await expect(executor.execute(TURN, { orderId: "o1" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: reason,
            facts,
        })
        expect(sender.composed).not.toHaveBeenCalled()
        expect(rematch.execute).not.toHaveBeenCalled()
        expect(schedule.execute).not.toHaveBeenCalled()
    })

    it("answers a send the customer-send rules refuse as its own refusal, with the reason, and arms nothing", async () => {
        const { executor, sender, rematch, schedule } = await build()
        sender.composed.mockResolvedValue({
            kind: "refused",
            id: "held_by_person",
            facts: { heldBy: "u1", at: { x: 1 } },
        })

        await expect(executor.execute(TURN, { orderId: "o1" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "send_refused",
            facts: { heldBy: "u1", reason: "held_by_person", orderNo: "DH-20261110-0001", amountVnd: 300_000 },
        })
        expect(rematch.execute).not.toHaveBeenCalled()
        expect(schedule.execute).not.toHaveBeenCalled()
    })

    it("refuses a turn that serves no conversation, and a payload without an order", async () => {
        const { executor } = await build()
        await expect(executor.execute({ ...TURN, conversationId: null }, { orderId: "o1" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "no_conversation",
            facts: { orderNo: "DH-20261110-0001" },
        })
        await expect(executor.execute(TURN, {}, CALL)).rejects.toMatchObject({ code: "SALES_EFFECTS_INVALID_PAYLOAD" })
    })

    it("sends the words alone, with the QR link in them, through a send executor that takes no composed message", async () => {
        const { executor, sender } = await build({ composing: false })
        await expect(executor.execute(TURN, { orderId: "o1" }, CALL)).resolves.toMatchObject({ id: "m-plain" })
        expect(sender.execute).toHaveBeenCalledWith(
            TURN,
            { conversationId: "conv-1", text: expect.stringContaining(QR) },
            { key: "run-1:qr:0:send", dedupeKey: "payment-request:o1" },
        )
    })
})

describe("the policy of a payment request", () => {
    it("takes a confirmed order with a total, and nothing else", () => {
        expect(payableOrderOf(ORDER)).toEqual({
            orderNo: "DH-20261110-0001",
            amountVnd: 300_000,
            items: ORDER.items,
            address: "25 Nguyen Hue",
        })
        expect(payableOrderOf({ ...ORDER, status: "paid" })).toMatchObject({ refused: "order_not_payable" })
        expect(payableOrderOf({ ...ORDER, amountVnd: 0 })).toMatchObject({ refused: "order_not_payable" })
        expect(payableOrderOf({})).toEqual({ refused: "order_missing", facts: {} })
    })
})
