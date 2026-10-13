import { mock } from "@starci/jest-preset"
import type { AutomationsService } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { ListGoogleAccountsResult } from "./list-google-accounts.contracts"
import { ListGoogleAccountsHandler } from "./list-google-accounts.handler"
import { ListGoogleAccountsQuery } from "./list-google-accounts.query"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const MESSAGE = new ListGoogleAccountsQuery({ principal: PRINCIPAL, request: { workspaceId: "ws-1" } })
const ACCOUNTS: ListGoogleAccountsResult = [{ id: "g-1", email: "sheets@example.com", status: "active" }]

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new ListGoogleAccountsHandler(logger, automations), automations, logger }
}

describe("ListGoogleAccountsHandler", () => {
    it("returns the Google accounts for the verified member and workspace", async () => {
        const { handler, automations, logger } = build()
        automations.googleAccounts.mockResolvedValue(ACCOUNTS)

        await expect(handler.execute(MESSAGE)).resolves.toBe(ACCOUNTS)

        expect(automations.googleAccounts).toHaveBeenCalledTimes(1)
        expect(automations.googleAccounts).toHaveBeenCalledWith("u-1", "ws-1")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows an accounts failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("Google accounts unavailable")
        automations.googleAccounts.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.googleAccounts).toHaveBeenCalledWith("u-1", "ws-1")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "ListGoogleAccountsHandler",
        })
    })
})
