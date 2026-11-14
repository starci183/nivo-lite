import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { SandboxAccountsQuery } from "./provider-sandbox.queries"
import { SandboxAccountsHandler } from "./sandbox-accounts.handler"
import type { SandboxAttachmentsService } from "./sandbox-attachments.service"

describe("SandboxAccountsHandler", () => {
    it("lists the workspace's sandbox accounts with their agents as the signed-in person", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        const views = [{ account: connectionRecord({ id: "c-1", sandbox: true }), agents: [{ id: "a-1", label: "Lan" }] }]
        attachments.list.mockResolvedValue(views)

        const found = await new SandboxAccountsHandler(mock<Logger>(), attachments).execute(
            new SandboxAccountsQuery({ request: { workspaceId: "ws-1" }, principal: { id: "user-1", role: "authenticated" } }),
        )

        expect(attachments.list).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" })
        expect(found).toBe(views)
    })
})
