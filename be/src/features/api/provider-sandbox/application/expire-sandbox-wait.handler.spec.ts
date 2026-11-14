import { mock } from "@starci/jest-preset"
import type { ThreadWaitExpiryService } from "@modules/domain/agent-threads"
import type { ProviderSandboxAccountsService } from "@modules/domain/provider-sandbox"
import type { Logger } from "@modules/platform/logging"
import { ExpireSandboxWaitCommand } from "./provider-sandbox.commands"
import { ExpireSandboxWaitHandler } from "./expire-sandbox-wait.handler"

/** The command of one expiry. */
const expireOf = () =>
    new ExpireSandboxWaitCommand({
        request: { workspaceId: "ws-1", runId: "run-1" },
        principal: { id: "user-1", role: "authenticated" },
    })

/** The handler over mocked doors. */
const handlerOf = () => {
    const accounts = mock<ProviderSandboxAccountsService>()
    const expiry = mock<ThreadWaitExpiryService>()
    accounts.assertManager.mockResolvedValue(undefined)
    return { accounts, expiry, handler: new ExpireSandboxWaitHandler(mock<Logger>(), accounts, expiry) }
}

describe("ExpireSandboxWaitHandler", () => {
    it("checks the gate as the signed-in person, then expires the wait and answers the run", async () => {
        const { accounts, expiry, handler } = handlerOf()
        expiry.expireNow.mockResolvedValue("admitted")

        const result = await handler.execute(expireOf())

        expect(accounts.assertManager).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" })
        expect(expiry.expireNow).toHaveBeenCalledWith("ws-1", "run-1")
        expect(result).toEqual({ runId: "run-1", outcome: "admitted" })
        expect(accounts.assertManager.mock.invocationCallOrder[0]).toBeLessThan(expiry.expireNow.mock.invocationCallOrder[0] ?? 0)
    })

    it.each(["closed", "moved", "early", "refused"] as const)("refuses RunNotWaiting with the engine's word %p", async (outcome) => {
        const { expiry, handler } = handlerOf()
        expiry.expireNow.mockResolvedValue(outcome)

        await expect(handler.execute(expireOf())).rejects.toMatchObject({
            code: "PROVIDER_SANDBOX_RUN_NOT_WAITING",
            params: { runId: "run-1", reason: outcome },
        })
    })

    it("never touches the engine when the gate refuses (switch off, or not an owner or manager)", async () => {
        const { accounts, expiry, handler } = handlerOf()
        accounts.assertManager.mockRejectedValue({ code: "PROVIDER_SANDBOX_OFF" })

        await expect(handler.execute(expireOf())).rejects.toMatchObject({ code: "PROVIDER_SANDBOX_OFF" })
        expect(expiry.expireNow).not.toHaveBeenCalled()
    })
})
