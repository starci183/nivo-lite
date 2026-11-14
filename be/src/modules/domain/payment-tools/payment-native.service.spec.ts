import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService, type ConnectionRecord, type Provider } from "@modules/domain/connections"
import { ToolsErrorCode, type NativeCaller } from "@modules/domain/tools"
import { PaymentInstructionRegistryService, providerCallFailure, providerRefusal } from "@modules/domain/provider-registry"
import type { PaymentInstructionPort, TransferInstruction } from "@modules/domain/provider-registry"
import { AccountDataReadService, AccountDataTypesService, type AccountDataTypeDef } from "@modules/domain/account-data"
import { PAYMENT_REFUSAL_CLASS, PAYMENT_TOOL_BUSINESS_REFUSALS, PAYMENT_TOOL_REFUSALS } from "./payment-refusal.policy"
import { TRANSFER_CONTENT_MAX, TRANSFER_CREATE_SCHEMA } from "./payment-native.schema"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { PAYMENT_MANIFEST, PAYMENT_TOOL, PaymentNativeService } from "./payment-native.service"

const ACCOUNT: ConnectionRecord = connectionRecord({ id: "conn-1", provider: "sepay", name: "Bank" })
const caller = (connectionId?: string): NativeCaller => ({
    agentId: "agent-1",
    conversationId: null,
    ...(connectionId === undefined ? {} : { connectionId, provider: "sepay" }),
})

// A handwritten instruction in the shape SePay's own documentation example gives (https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code):
// acc, bank, amount, des fixed in the image address.
const INSTRUCTION: TransferInstruction = {
    qrImageUrl: "https://vietqr.app/img?acc=9988776655&bank=Vietcombank&amount=100000&des=DH001",
    bankCode: "Vietcombank",
    accountNumber: "9988776655",
    content: "DH001",
    amountVnd: 100000,
}

const build = async (options: { readonly found?: ConnectionRecord | null } = {}) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(options.found === undefined ? ACCOUNT : options.found)
    const port = mock<PaymentInstructionPort>({ provider: "sepay" })
    port.transfer.mockResolvedValue(INSTRUCTION)
    const registry = new PaymentInstructionRegistryService()
    registry.register(port)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: PaymentInstructionRegistryService, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentNativeService), port, connections }
}

const paramsOf = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(work.then(
        () => null,
        (cause: unknown) => (typeof cause === "object" && cause !== null && "params" in cause ? cause.params : undefined) ?? cause,
    ))

describe("the payment-instruction manifest", () => {
    it("names the generic purposes under nivo.tool, internal only, reads: the transfer instruction and one credit", () => {
        expect(PAYMENT_MANIFEST.tools.map((tool) => tool.domain)).toEqual(["nivo.tool.payment.transfer.create", "nivo.tool.payment.credit.get"])
        for (const tool of PAYMENT_MANIFEST.tools) {
            expect(`${PAYMENT_MANIFEST.namespace ?? ""}.${tool.name}`).toBe(tool.domain)
            expect(tool.internalOnly).toBe(true)
            expect(tool.scope).toBe("read")
        }
    })

    it("classes every refusal; business only for what the node may go on from", () => {
        expect([...PAYMENT_TOOL_REFUSALS]).toEqual(Object.keys(PAYMENT_REFUSAL_CLASS))
        expect(Object.entries(PAYMENT_REFUSAL_CLASS).filter(([, kind]) => kind === "business").map(([reason]) => reason)).toEqual([
            ...PAYMENT_TOOL_BUSINESS_REFUSALS,
        ])
    })
})

describe("the transfer arguments", () => {
    it("takes a positive whole amount and a bounded content, nothing else", () => {
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 100000, content: "DH001" }).success).toBe(true)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 0, content: "DH001" }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: -5, content: "DH001" }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 10.5, content: "DH001" }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 1000, content: "" }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 1000, content: "   " }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 1000, content: "x".repeat(TRANSFER_CONTENT_MAX) }).success).toBe(true)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 1000, content: "x".repeat(TRANSFER_CONTENT_MAX + 1) }).success).toBe(false)
        expect(TRANSFER_CREATE_SCHEMA.safeParse({ amountVnd: 1000, content: "A", extra: 1 }).success).toBe(false)
    })
})

describe("PaymentNativeService", () => {
    it("asks the port of the handed account and answers the members it gave, no more", async () => {
        const { service, port, connections } = await build()
        const answer = await service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 100000, content: " DH001 " }, caller("conn-1"))
        expect(connections.find).toHaveBeenCalledWith("ws-1", "conn-1")
        expect(port.transfer).toHaveBeenCalledWith(ACCOUNT, { amountVnd: 100000, content: "DH001" })
        expect(answer).toEqual(INSTRUCTION)
        expect(answer).not.toHaveProperty("accountHolder")
    })

    it("refuses with not_connected when no account was handed, the account is gone or its provider serves no instruction", async () => {
        const none = await build()
        expect(await paramsOf(none.service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller()))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
        const gone = await build({ found: null })
        expect(await paramsOf(gone.service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1")))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
        const other = await build({ found: { ...ACCOUNT, provider: "casso" } })
        expect(await paramsOf(other.service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1")))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
    })

    it("answers a provider's refusal as the tool's own, the class kept", async () => {
        const { service, port } = await build()
        port.transfer.mockRejectedValueOnce(providerRefusal("sepay", "no_credential"))
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1")))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
        port.transfer.mockRejectedValueOnce(providerRefusal("sepay", "rejected"))
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1")))).toEqual({
            reason: "rejected",
            refusalClass: "business",
        })
        port.transfer.mockRejectedValueOnce(providerRefusal("sepay", "auth_refused"))
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1")))).toEqual({
            reason: "connection_refused",
            refusalClass: "infrastructure",
        })
    })

    it("throws any other failure as it is, with what it proves (the runner reads `not_sent` / `unknown`)", async () => {
        const { service, port } = await build()
        const failure = providerCallFailure("unknown")
        port.transfer.mockRejectedValueOnce(failure)
        await expect(service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1"))).rejects.toBe(failure)
        const sent = providerCallFailure("not_sent")
        port.transfer.mockRejectedValueOnce(sent)
        await expect(service.invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 1, content: "A" }, caller("conn-1"))).rejects.toBe(sent)
    })

    it("refuses an argument outside its bounds before it asks any account", async () => {
        const { service, connections } = await build()
        const failure = await service
            .invoke("ws-1", PAYMENT_TOOL.transferCreate, { amountVnd: 0, content: "A" }, caller("conn-1"))
            .then(() => null, (cause: unknown) => cause)
        expect(failure).not.toBeNull()
        expect(connections.find).not.toHaveBeenCalled()
    })

    it("answers an unknown tool as unknown", async () => {
        const { service } = await build()
        await expect(service.invoke("ws-1", "payment.nothing", {}, caller("conn-1"))).rejects.toBeDefined()
        expect(ToolsErrorCode.NativeRefused).toBeDefined()
    })
})

// ---- nivo.tool.payment.credit.get: one bank move of an attached account, from its raw row, provider by provider --------------------
//
// Ruling R51 item 2: the move is read by the PROVIDER'S id of it (the bank trigger's `data.transactionId`, the key the feed's intake kept
// the row under: `sepay:<id>`, `casso:<id>`, `payos:<ref>`), never by the row's own uuid. The account store double keeps the two apart as
// the database does: `get` finds a row by (account, type, key) only, `byId` by the row's uuid only. (Before, this spec asked by an id it
// invented as BOTH the row id and the asked id (`row-sepay`), and its `byId` double answered it, while the row's own `transactionId` was
// `sp-1`: no case ever asked with what the trigger hands the run, so the uuid read the dev run failed on was green here.)

/** The raw `<provider>.transaction` rows the feeds keep: the same declared fields, each provider's own values and key. */
const ROW_VALUES: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    sepay: { transactionId: "sepay:94624259", amount: 250000, direction: "credit", content: "DH0042", account: "0123456789", bankRef: "FT26317", at: "2026-11-13T03:00:00.000Z", source: "webhook" },
    casso: { transactionId: "casso:77001", amount: 99000, direction: "credit", content: "DH0043", account: "9988776655", at: "2026-11-13T03:00:00.000Z", source: "poll" },
    payos: { transactionId: "payos:FT-55", amount: 120000, direction: "credit", content: "DH0044", at: "2026-11-13T03:00:00.000Z", source: "webhook" },
}

/** The row's own id (a uuid, as `account_data.id`): never what a run asks with. */
const ROW_IDS: Readonly<Record<string, string>> = {
    sepay: "5b0d1c2e-0000-4000-8000-000000000001",
    casso: "5b0d1c2e-0000-4000-8000-000000000002",
    payos: "5b0d1c2e-0000-4000-8000-000000000003",
}

type OptionalStoredRow = Awaited<ReturnType<AccountDataReadService["get"]>>

const storedRow = (provider: string, value: Readonly<Record<string, unknown>>): OptionalStoredRow => ({
    id: ROW_IDS[provider] ?? "",
    type: `${provider}.transaction`,
    typeVersion: 1,
    key: typeof value.transactionId === "string" ? value.transactionId : "",
    value,
    occurredAt: new Date("2026-11-13T03:00:05.000Z"),
    processedAt: null,
})

const typeOf = (provider: string, purpose = "bank.transaction", name = `${provider}.transaction`): AccountDataTypeDef => ({
    name,
    provider,
    version: 1,
    write: "append",
    fields: {},
    key: [],
    retention: "keep",
    purpose,
})

const BANK_PROVIDERS: ReadonlyArray<Provider> = ["sepay", "casso", "payos"]

/**
 * A service over bank accounts of the three providers (`conn-<provider>`), each holding one row; `own` says which connections the
 * workspace holds. The store double answers as the database does: `get` by (account, type, key), `byId` by the row uuid.
 */
const bankBuild = async (own: ReadonlySet<string> = new Set(["conn-sepay", "conn-casso", "conn-payos"])) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockImplementation((_workspaceId: string, id: string) =>
        Promise.resolve(own.has(id) ? connectionRecord({ id, provider: BANK_PROVIDERS.find((bank) => `conn-${bank}` === id) ?? "sepay", name: "Bank" }) : null),
    )
    const rows = mock<AccountDataReadService>()
    rows.get.mockImplementation((connectionId: string, type: string, key: string) => {
        const provider = type.replace(".transaction", "")
        const value = ROW_VALUES[provider]
        const found = value !== undefined && connectionId === `conn-${provider}` && key === value.transactionId
        return Promise.resolve(found ? storedRow(provider, value) : null)
    })
    rows.byId.mockImplementation((type: string, id: string) => {
        const provider = type.replace(".transaction", "")
        const value = ROW_VALUES[provider]
        const row = value !== undefined && id === ROW_IDS[provider] ? storedRow(provider, value) : null
        return Promise.resolve(row === null ? null : { ...row, connectionId: `conn-${provider}`, createdAt: "2026-11-13T03:00:05.000000Z" })
    })
    const types = mock<AccountDataTypesService>()
    types.all.mockReturnValue([typeOf("sepay"), typeOf("casso"), typeOf("payos"), typeOf("sepay", "bank.event", "sepay.delivery")])
    const registry = new PaymentInstructionRegistryService()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentNativeService,
            { provide: ConnectionsService, useValue: connections },
            { provide: PaymentInstructionRegistryService, useValue: registry },
            { provide: AccountDataReadService, useValue: rows },
            { provide: AccountDataTypesService, useValue: types },
        ],
    }).compile()
    return { service: moduleRef.get(PaymentNativeService), rows, connections }
}

const bankCaller = (provider: string, connectionId = `conn-${provider}`): NativeCaller => ({ agentId: "agent-1", conversationId: null, connectionId, provider })

/** The provider's id of a provider's move (what the bank trigger hands a run). */
const keyOf = (provider: string): string => String(ROW_VALUES[provider]?.transactionId)

describe("PaymentNativeService credit.get", () => {
    it.each(["sepay", "casso", "payos"])("%s: answers the move asked by its provider id as the neutral credit, its id the same provider id", async (provider) => {
        const { service } = await bankBuild()
        const value = ROW_VALUES[provider] ?? {}
        const answer = await service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: keyOf(provider) }, bankCaller(provider))
        expect(answer).toEqual({
            id: keyOf(provider),
            direction: "in",
            amountVnd: value.amount,
            content: value.content,
            at: "2026-11-13T03:00:00.000Z",
            ...("account" in value ? { account: value.account } : {}),
            ...("bankRef" in value ? { bankRef: value.bankRef } : {}),
        })
    })

    it("reads the handed account's row of the bank-transaction type by its key, never by a row id", async () => {
        const { service, rows } = await bankBuild()
        await service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: keyOf("casso") }, bankCaller("casso"))
        expect(rows.get).toHaveBeenCalledTimes(1)
        expect(rows.get).toHaveBeenCalledWith("conn-casso", "casso.transaction", keyOf("casso"))
        expect(rows.byId).not.toHaveBeenCalled()
    })

    it("answers not_found when asked by the row's own uuid (the id form the bank trigger never hands)", async () => {
        const { service } = await bankBuild()
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: ROW_IDS.sepay ?? "" }, bankCaller("sepay")))).toEqual({
            reason: "not_found",
            refusalClass: "business",
        })
    })

    it("answers not_found for a move of an account that is not the handed one, and not_connected for a handed account the workspace does not hold", async () => {
        const { service } = await bankBuild()
        // The move is the sepay account's; the node handed the casso account.
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: keyOf("sepay") }, bankCaller("casso")))).toEqual({
            reason: "not_found",
            refusalClass: "business",
        })
        // The handed account is not the workspace's own.
        const foreign = await bankBuild(new Set(["conn-casso"]))
        expect(await paramsOf(foreign.service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: keyOf("sepay") }, bankCaller("sepay")))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
    })

    it("answers not_found for an id no row holds, and for a row that is no bank move", async () => {
        const { service, rows } = await bankBuild()
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: "sepay:nope" }, bankCaller("sepay")))).toEqual({
            reason: "not_found",
            refusalClass: "business",
        })
        rows.get.mockResolvedValueOnce(storedRow("sepay", { transactionId: "sepay:x", amount: "x" }))
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: "sepay:x" }, bankCaller("sepay")))).toEqual({
            reason: "not_found",
            refusalClass: "business",
        })
    })

    it("refuses with not_connected when no account was handed, and reads nothing for an invalid id", async () => {
        const { service, rows } = await bankBuild()
        expect(await paramsOf(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: keyOf("sepay") }, caller()))).toEqual({
            reason: "not_connected",
            refusalClass: "infrastructure",
        })
        const failure = await service
            .invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: "" }, bankCaller("sepay"))
            .then(() => null, (cause: unknown) => cause)
        expect(failure).not.toBeNull()
        expect(rows.get).not.toHaveBeenCalled()
    })

    it("answers as unknown in an app that holds no account store", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentNativeService,
                { provide: ConnectionsService, useValue: mock<ConnectionsService>() },
                { provide: PaymentInstructionRegistryService, useValue: new PaymentInstructionRegistryService() },
            ],
        }).compile()
        const service = moduleRef.get(PaymentNativeService)
        await expect(service.invoke("ws-1", PAYMENT_TOOL.creditGet, { transactionId: "r" }, bankCaller("sepay"))).rejects.toBeDefined()
    })
})

