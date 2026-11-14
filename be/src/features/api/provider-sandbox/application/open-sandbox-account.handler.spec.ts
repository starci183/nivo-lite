import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { OpenSandboxAccountHandler } from "./open-sandbox-account.handler"
import { OpenSandboxAccountCommand } from "./provider-sandbox.commands"
import type { SandboxAttachmentsService } from "./sandbox-attachments.service"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

/** The command of one open. */
const openOf = (attachTo: ReadonlyArray<string>) =>
    new OpenSandboxAccountCommand({
        request: { workspaceId: "ws-1", provider: "sepay", name: "SePay sandbox", attachTo },
        principal: { id: "user-1", role: "authenticated" },
    })

describe("OpenSandboxAccountHandler", () => {
    it("opens as the signed-in person and hands the agents to attach to the one service", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        attachments.open.mockResolvedValue({ id: "c-1", sandboxKey: "sbx" })

        const opened = await new OpenSandboxAccountHandler(mock<Logger>(), attachments).execute(openOf(["a-1", "a-2"]))

        expect(attachments.open).toHaveBeenCalledWith(ACTOR, { provider: "sepay", name: "SePay sandbox", attachTo: ["a-1", "a-2"] })
        expect(opened).toEqual({ id: "c-1", sandboxKey: "sbx" })
    })

    it("passes an empty attachTo through: the account stands alone", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        attachments.open.mockResolvedValue({ id: "c-1", sandboxKey: "sbx" })

        await new OpenSandboxAccountHandler(mock<Logger>(), attachments).execute(openOf([]))

        expect(attachments.open).toHaveBeenCalledWith(ACTOR, expect.objectContaining({ attachTo: [] }))
    })

    it("lets a refusal of the service through untouched", async () => {
        const attachments = mock<SandboxAttachmentsService>()
        const refused = new Error("refused")
        attachments.open.mockRejectedValue(refused)

        await expect(new OpenSandboxAccountHandler(mock<Logger>(), attachments).execute(openOf(["a-1"]))).rejects.toBe(refused)
    })
})
