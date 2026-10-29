import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { McpGatewayReceiptsError, McpGatewayReceiptsErrorCode } from "./errors/mcp-gateway-receipts.error"
import { GatewayReceiptsService } from "./gateway-receipts.service"
import type { GatewayCallResult } from "./mcp-gateway-receipts.contracts"
import { McpGatewayReceiptEntity } from "./persistence/entities"

const WORKSPACE = "workspace-1"
const KEY = "message-1:hakuen.booking.hold"
const RESULT: GatewayCallResult = { ok: true, value: { bookingId: "hold-1", keycode: "private-result" } }
const PENDING: GatewayCallResult = { ok: false, code: "unknown_outcome", detail: "operation_pending" }
const SEALED = "sealed-result"
const SEALED_PENDING = "sealed-pending"

const receipt = (resultSealed: string) => Object.assign(new McpGatewayReceiptEntity(), { resultSealed })

const INSERT_CALL = (workspaceId: string, resultSealed: string) => [
    McpGatewayReceiptEntity,
    { workspaceId, operationKey: KEY, resultSealed },
]
const UPDATE_CALL = (workspaceId: string, resultSealed: string) => [
    McpGatewayReceiptEntity,
    { workspaceId, operationKey: KEY },
    { resultSealed },
]
const SELECT_CALL = [
    McpGatewayReceiptEntity,
    { select: { resultSealed: true }, where: { workspaceId: WORKSPACE, operationKey: KEY } },
]

const build = async (row: McpGatewayReceiptEntity | null = receipt(SEALED)) => {
    const tx = fakeTransaction(
        mockEntityManager({
            insert: [McpGatewayReceiptEntity, {}],
            update: [McpGatewayReceiptEntity, {}],
            findOne: [McpGatewayReceiptEntity, row],
        }),
    )
    const inbox: Inbox = fakeInbox()
    const claim = jest.spyOn(inbox, "claim")
    const secrets = mock<ConnectionSecretsService>()
    secrets.seal.mockImplementation((plain) => (plain === JSON.stringify(PENDING) ? SEALED_PENDING : SEALED))
    secrets.open.mockImplementation((sealed) => ({
        kind: "ok",
        value: JSON.stringify(sealed === SEALED_PENDING ? PENDING : RESULT),
    }))
    const another = async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                GatewayReceiptsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
                { provide: INBOX, useValue: inbox },
                { provide: ConnectionSecretsService, useValue: secrets },
            ],
        }).compile()
        return moduleRef.get(GatewayReceiptsService)
    }
    return { service: await another(), another, tx, claim, secrets }
}

const fault = (phase: string) =>
    new McpGatewayReceiptsError({ code: McpGatewayReceiptsErrorCode.Unreadable, params: { phase } })

describe("GatewayReceiptsService intent", () => {
    it("commits the claim and sealed pending intent before acting, then seals the final answer", async () => {
        const { service, tx, claim, secrets } = await build()
        const operation = jest.fn(() => {
            expect(claim).toHaveBeenCalledWith("mcp.gateway", `${WORKSPACE}:${KEY}`, expect.anything())
            expect(isTransactionManager(claim.mock.calls[0]?.[2])).toBe(true)
            expect(tx.commits).toBe(1)
            expect(tx.em.insert.mock.calls).toEqual([INSERT_CALL(WORKSPACE, SEALED_PENDING)])
            expect(tx.em.update).not.toHaveBeenCalled()
            return Promise.resolve(RESULT)
        })
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(RESULT)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(secrets.seal).toHaveBeenCalledWith(JSON.stringify(RESULT))
        expect(tx.em.insert.mock.calls).toEqual([INSERT_CALL(WORKSPACE, SEALED_PENDING)])
        expect(tx.em.update.mock.calls).toEqual([UPDATE_CALL(WORKSPACE, SEALED)])
        expect(JSON.stringify([tx.em.insert.mock.calls, tx.em.update.mock.calls])).not.toContain("private-result")
        expect(tx.commits).toBe(1)
    })
})

describe("GatewayReceiptsService concurrent replay", () => {
    it("returns pending intent to a concurrent gateway instance without a second hold", async () => {
        const { service, another, claim, tx, secrets } = await build(receipt(SEALED_PENDING))
        const other = await another()
        let finishOperation = () => {}
        const released = new Promise<void>((resolve) => {
            finishOperation = resolve
        })
        let markStarted = () => {}
        const started = new Promise<void>((resolve) => {
            markStarted = resolve
        })
        const operation = jest.fn(async () => {
            markStarted()
            await released
            return RESULT
        })
        claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const first = service.run(WORKSPACE, KEY, operation)
        await started
        await expect(other.run(WORKSPACE, KEY, operation)).resolves.toEqual(PENDING)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(secrets.open).toHaveBeenCalledWith(SEALED_PENDING)
        finishOperation()
        await expect(first).resolves.toEqual(RESULT)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(tx.em.insert.mock.calls).toEqual([INSERT_CALL(WORKSPACE, SEALED_PENDING)])
        expect(tx.em.findOne.mock.calls).toEqual([SELECT_CALL])
        expect(tx.em.update.mock.calls).toEqual([UPDATE_CALL(WORKSPACE, SEALED)])
        expect(tx.commits).toBe(2)
    })

    it("returns the completed success without calling the connector again", async () => {
        const { service, claim, secrets } = await build()
        claim.mockResolvedValue(false)
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(RESULT)
        expect(operation).not.toHaveBeenCalled()
        expect(secrets.open).toHaveBeenCalledWith(SEALED)
        expect(secrets.seal).not.toHaveBeenCalled()
    })
})

describe("GatewayReceiptsService workspace and unsuccessful outcomes", () => {
    it("scopes both the inbox identity and persisted results to the workspace", async () => {
        const { service, claim, tx } = await build()
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await service.run(WORKSPACE, KEY, operation)
        await service.run("workspace-2", KEY, operation)
        expect(operation).toHaveBeenCalledTimes(2)
        expect(claim).toHaveBeenNthCalledWith(1, "mcp.gateway", `${WORKSPACE}:${KEY}`, expect.anything())
        expect(claim).toHaveBeenNthCalledWith(2, "mcp.gateway", `workspace-2:${KEY}`, expect.anything())
        expect(tx.em.insert.mock.calls).toEqual([
            INSERT_CALL(WORKSPACE, SEALED_PENDING),
            INSERT_CALL("workspace-2", SEALED_PENDING),
        ])
        expect(tx.em.update.mock.calls).toEqual([UPDATE_CALL(WORKSPACE, SEALED), UPDATE_CALL("workspace-2", SEALED)])
    })

    it.each<GatewayCallResult>([
        { ok: false, code: "unknown_outcome", detail: "remote timed out" },
        { ok: false, code: "tool_error", detail: "connector refused" },
        { ok: false, code: "idempotency_key_required", detail: "hakuen.booking.confirm" },
        { ok: false, code: "approval_required", reason: "ask_mode" },
    ])("keeps the first unsuccessful outcome for retries: %j", async (result) => {
        const { service, claim, secrets } = await build()
        const operation = jest.fn(() => Promise.resolve(result))
        claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        secrets.open.mockReturnValue({ kind: "ok", value: JSON.stringify(result) })
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(result)
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(result)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(secrets.seal).toHaveBeenCalledWith(JSON.stringify(result))
    })
})

describe("GatewayReceiptsService operation failure", () => {
    it("keeps pending intent when an operation throws so its retry cannot act again", async () => {
        const { service, tx, claim } = await build(receipt(SEALED_PENDING))
        const failure = fault("operation failed before its outcome")
        const operation = jest.fn<Promise<GatewayCallResult>, []>().mockRejectedValue(failure)
        claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toBe(failure)
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(PENDING)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(tx.rollbacks).toBe(0)
        expect(tx.commits).toBe(2)
        expect(tx.em.insert.mock.calls).toEqual([INSERT_CALL(WORKSPACE, SEALED_PENDING)])
        expect(tx.em.findOne.mock.calls).toEqual([SELECT_CALL])
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("GatewayReceiptsService failed intent", () => {
    it("rolls back the claim if sealing intent fails before the operation can run", async () => {
        const { service, tx, secrets } = await build()
        const failure = fault("cipher unavailable")
        secrets.seal.mockImplementation(() => {
            throw failure
        })
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toBe(failure)
        expect(tx.rollbacks).toBe(1)
        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(operation).not.toHaveBeenCalled()
    })

    it("does not issue the operation when pending intent cannot be persisted", async () => {
        const { service, tx } = await build()
        const failure = fault("intent write failed")
        tx.em.insert.mockRejectedValueOnce(failure)
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toBe(failure)
        expect(operation).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("GatewayReceiptsService failed completion", () => {
    it("keeps pending intent when final sealing fails so a retry cannot call twice", async () => {
        const { service, tx, claim, secrets } = await build(receipt(SEALED_PENDING))
        const failure = fault("final sealing failed")
        secrets.seal.mockReturnValueOnce(SEALED_PENDING).mockImplementationOnce(() => {
            throw failure
        })
        claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toBe(failure)
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(PENDING)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(tx.rollbacks).toBe(0)
    })

    it("keeps pending intent when the final update fails so a retry cannot call twice", async () => {
        const { service, tx, claim } = await build(receipt(SEALED_PENDING))
        const failure = fault("receipt write failed")
        tx.em.update.mockRejectedValueOnce(failure)
        claim.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toBe(failure)
        await expect(service.run(WORKSPACE, KEY, operation)).resolves.toEqual(PENDING)
        expect(operation).toHaveBeenCalledTimes(1)
        expect(tx.rollbacks).toBe(0)
    })
})

describe("GatewayReceiptsService unreadable receipts", () => {
    it("refuses a claim without a completed receipt instead of acting again", async () => {
        const { service, tx, claim, secrets } = await build(null)
        claim.mockResolvedValue(false)
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toMatchObject({
            code: McpGatewayReceiptsErrorCode.Unreadable,
        })
        expect(operation).not.toHaveBeenCalled()
        expect(secrets.open).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })

    it("refuses a receipt the custody service cannot open", async () => {
        const { service, claim, secrets } = await build()
        claim.mockResolvedValue(false)
        secrets.open.mockReturnValue({ kind: "refused", code: ConnectionSecretsErrorCode.Unreadable })
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toMatchObject({
            code: McpGatewayReceiptsErrorCode.Unreadable,
        })
        expect(operation).not.toHaveBeenCalled()
    })

    it.each([
        "{broken",
        "null",
        "[]",
        '"text"',
        "{}",
        '{"ok":true,"value":null}',
        '{"ok":true,"value":[]}',
        '{"ok":false,"code":"approval_required"}',
        '{"ok":false,"code":"approval_required","reason":"invalid"}',
        '{"ok":false}',
        '{"ok":false,"code":"invalid"}',
        '{"ok":false,"code":"tool_error"}',
        '{"ok":false,"code":"idempotency_key_required"}',
    ])("refuses corrupt receipt JSON %s without acting again", async (json) => {
        const { service, claim, secrets } = await build()
        claim.mockResolvedValue(false)
        secrets.open.mockReturnValue({ kind: "ok", value: json })
        const operation = jest.fn(() => Promise.resolve(RESULT))
        await expect(service.run(WORKSPACE, KEY, operation)).rejects.toMatchObject({
            code: McpGatewayReceiptsErrorCode.Unreadable,
        })
        expect(operation).not.toHaveBeenCalled()
    })
})
