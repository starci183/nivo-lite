import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { AttachSandboxAccountHandler } from "./attach-sandbox-account.handler"
import { DetachSandboxAccountHandler } from "./detach-sandbox-account.handler"
import { AttachSandboxAccountCommand, DetachSandboxAccountCommand } from "./provider-sandbox.commands"
import type { SandboxAccountView } from "./provider-sandbox.contracts"
import type { SandboxAttachmentsService } from "./sandbox-attachments.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }
const VIEW: SandboxAccountView = { account: connectionRecord({ id: "c-1", sandbox: true }), agents: [{ id: "a-1", label: "Lan" }] }
const PARAMS = { request: { workspaceId: "ws-1", connectionId: "c-1", agentId: "a-1" }, principal: { id: "user-1", role: "authenticated" as const } }

describe("AttachSandboxAccountHandler and DetachSandboxAccountHandler", () => {
    it("attaches as the signed-in person and answers the account with its agents", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        attachments.attach.mockResolvedValue(VIEW)

        const view = await new AttachSandboxAccountHandler(mock<Logger>(), attachments).execute(new AttachSandboxAccountCommand(PARAMS))

        expect(attachments.attach).toHaveBeenCalledWith(ACTOR, "c-1", "a-1")
        expect(view).toBe(VIEW)
    })

    it("detaches as the signed-in person and answers the account with its agents", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        attachments.detach.mockResolvedValue({ ...VIEW, agents: [] })

        const view = await new DetachSandboxAccountHandler(mock<Logger>(), attachments).execute(new DetachSandboxAccountCommand(PARAMS))

        expect(attachments.detach).toHaveBeenCalledWith(ACTOR, "c-1", "a-1")
        expect(view.agents).toEqual([])
    })

    it("lets the refusals (live account, switch off) through untouched", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        const refused = new Error("PROVIDER_SANDBOX_LIVE_ACCOUNT")
        attachments.attach.mockRejectedValue(refused)
        attachments.detach.mockRejectedValue(refused)

        await expect(new AttachSandboxAccountHandler(mock<Logger>(), attachments).execute(new AttachSandboxAccountCommand(PARAMS))).rejects.toBe(refused)
        await expect(new DetachSandboxAccountHandler(mock<Logger>(), attachments).execute(new DetachSandboxAccountCommand(PARAMS))).rejects.toBe(refused)
    })
})
