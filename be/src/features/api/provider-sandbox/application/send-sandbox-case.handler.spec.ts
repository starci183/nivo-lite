import { mock } from "@starci/jest-preset"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    ProviderSandboxError,
    ProviderSandboxErrorCode,
    type ProviderSandboxAccountsService,
    type SandboxCase,
    type SandboxSendResult,
} from "@modules/domain/provider-sandbox"
import type { Logger } from "@modules/platform/logging"
import { SendSandboxCaseCommand } from "./provider-sandbox.commands"
import { SendSandboxCaseHandler } from "./send-sandbox-case.handler"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const SENT: SandboxSendResult = { caseId: "SEPAY-1", input: { content: "x", amount: 5 }, deliveries: [] }
const ACCOUNT = { id: "c-1", provider: "sepay" } as ConnectionRecord
const CASES: ReadonlyArray<SandboxCase> = [
    {
        id: "SEPAY-1",
        label: "money in",
        inbound: {
            trigger: "money.received",
            path: (id) => `api/connections/sepay/${id}`,
            inputs: [
                { name: "content", label: "Content", kind: "text", example: "DH1" },
                { name: "amount", label: "Amount", kind: "integer", example: 1000 },
            ],
            eventsOf: () => Promise.resolve([]),
        },
    },
    { id: "SEPAY-2", label: "outbound", operation: "transfer", default: true },
]

/** A live account of the workspace: the door refuses it as live, never as unknown. */
const LIVE = "live-1"

/** The handler over a mocked door that holds one sepay sandbox account and refuses the others as its `account` read does. */
const handlerOf = () => {
    const accounts = mock<ProviderSandboxAccountsService>()
    accounts.account.mockImplementation((_actor, connectionId) => {
        if (connectionId === ACCOUNT.id) return Promise.resolve(ACCOUNT)
        const code = connectionId === LIVE ? ProviderSandboxErrorCode.LiveAccount : ProviderSandboxErrorCode.AccountNotFound
        return Promise.reject(new ProviderSandboxError({ code, params: { connectionId } }))
    })
    accounts.catalogue.mockResolvedValue(CASES)
    accounts.send.mockResolvedValue(SENT)
    return { accounts, handler: new SendSandboxCaseHandler(mock<Logger>(), accounts) }
}

/** The command of one send. */
const sendOf = (inputs: ReadonlyArray<{ name: string; value: string }>, caseId = "SEPAY-1", connectionId = "c-1") =>
    new SendSandboxCaseCommand({
        request: { workspaceId: "ws-1", connectionId, caseId, inputs },
        principal: { id: "user-1", role: "authenticated" },
    })

describe("SendSandboxCaseHandler", () => {
    it("converts each given value to its declared kind and sends as the signed-in person", async () => {
        const { accounts, handler } = handlerOf()

        const result = await handler.execute(
            sendOf([
                { name: "content", value: "DH42" },
                { name: "amount", value: " 250000 " },
            ]),
        )

        expect(accounts.catalogue).toHaveBeenCalledWith(ACTOR, "sepay")
        expect(accounts.send).toHaveBeenCalledWith(ACTOR, "c-1", "SEPAY-1", { content: "DH42", amount: 250000 })
        expect(result).toBe(SENT)
    })

    it("leaves out a name the case does not declare and sends nothing for fields not given (the domain prefills them)", async () => {
        const { accounts, handler } = handlerOf()

        await handler.execute(sendOf([{ name: "order", value: "A" }]))

        expect(accounts.send).toHaveBeenCalledWith(ACTOR, "c-1", "SEPAY-1", {})
    })

    it.each(["12.5", "abc", "", "9007199254740993", "1e3"])("refuses the integer %p naming the field", async (value) => {
        const { accounts, handler } = handlerOf()

        await expect(handler.execute(sendOf([{ name: "amount", value }]))).rejects.toMatchObject({
            code: "PROVIDER_SANDBOX_INPUT_INVALID",
            params: { field: "amount" },
        })
        expect(accounts.send).not.toHaveBeenCalled()
    })

    it("refuses an account that is not a sandbox account of the workspace", async () => {
        const { accounts, handler } = handlerOf()

        await expect(handler.execute(sendOf([], "SEPAY-1", "c-9"))).rejects.toMatchObject({
            code: "PROVIDER_SANDBOX_ACCOUNT_NOT_FOUND",
            params: { connectionId: "c-9" },
        })
        expect(accounts.send).not.toHaveBeenCalled()
    })

    it("refuses a LIVE account as live (`PROVIDER_SANDBOX_LIVE_ACCOUNT`), never as unknown (MX-CORE D2-3)", async () => {
        const { accounts, handler } = handlerOf()

        await expect(handler.execute(sendOf([], "SEPAY-1", LIVE))).rejects.toMatchObject({
            code: "PROVIDER_SANDBOX_LIVE_ACCOUNT",
            params: { connectionId: LIVE },
        })
        expect(accounts.account).toHaveBeenCalledWith(ACTOR, LIVE)
        expect(accounts.send).not.toHaveBeenCalled()
    })

    it("refuses a case that is unknown or is not an inbound one", async () => {
        const { accounts, handler } = handlerOf()

        await expect(handler.execute(sendOf([], "SEPAY-9"))).rejects.toMatchObject({ code: "PROVIDER_SANDBOX_CASE_UNKNOWN" })
        await expect(handler.execute(sendOf([], "SEPAY-2"))).rejects.toMatchObject({ code: "PROVIDER_SANDBOX_CASE_UNKNOWN" })
        expect(accounts.send).not.toHaveBeenCalled()
    })

    it("lets the door's refusal through unchanged (switch off)", async () => {
        const { accounts, handler } = handlerOf()
        accounts.account.mockRejectedValue({ code: "PROVIDER_SANDBOX_OFF" })

        await expect(handler.execute(sendOf([]))).rejects.toMatchObject({ code: "PROVIDER_SANDBOX_OFF" })
    })
})
