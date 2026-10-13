import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ChannelProvisioningService } from "@modules/domain/channel-provisioning"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { ConnectChannelCli } from "./connect-channel.cli"

const build = async () => {
    const provisioning = mock<ChannelProvisioningService>()
    provisioning.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectChannelCli, { provide: ChannelProvisioningService, useValue: provisioning }],
    }).compile()
    return { command: moduleRef.get(ConnectChannelCli), provisioning }
}

describe("ConnectChannelCli", () => {
    it("passes the first kind and every supplied flag to provisioning once", async () => {
        const { command, provisioning } = await build()
        const options = {
            workspace: "12345678-1234-1234-1234-123456789abc",
            name: "Payments",
            environment: "live",
            bankCode: "VCB",
            account: "00123456789",
            holder: "STARCI",
            bind: true,
        }

        await expect(command.run(["sepay", "ignored"], options)).resolves.toBeUndefined()

        expect(provisioning.run.mock.calls).toEqual([["sepay", options]])
        expect(provisioning.run.mock.calls[0]?.[1]).toBe(options)
    })

    it("defaults to empty flags when none are supplied", async () => {
        const { command, provisioning } = await build()

        await expect(command.run(["telegram"])).resolves.toBeUndefined()

        expect(provisioning.run.mock.calls).toEqual([["telegram", {}]])
    })

    it("passes an empty kind when no positional argument is supplied", async () => {
        const { command, provisioning } = await build()
        const options = { workspace: "12345678-1234-1234-1234-123456789abc" }

        await expect(command.run([], options)).resolves.toBeUndefined()

        expect(provisioning.run.mock.calls).toEqual([["", options]])
    })

    it("propagates provisioning's refusal of the unknown Zalo kind", async () => {
        const { command, provisioning } = await build()
        const refusal = new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field: "kind" } })
        const options = { workspace: "12345678-1234-1234-1234-123456789abc" }
        provisioning.run.mockRejectedValue(refusal)

        await expect(command.run(["zalo"], options)).rejects.toBe(refusal)

        expect(provisioning.run.mock.calls).toEqual([["zalo", options]])
    })

    it("keeps every option value exactly as supplied and enables binding", async () => {
        const { command, provisioning } = await build()

        expect(command.parseWorkspace("12345678-1234-1234-1234-123456789abc")).toBe(
            "12345678-1234-1234-1234-123456789abc",
        )
        expect(command.parseName(" Payments ")).toBe(" Payments ")
        expect(command.parseEnvironment("live")).toBe("live")
        expect(command.parseBankCode("VCB")).toBe("VCB")
        expect(command.parseAccount("00123456789")).toBe("00123456789")
        expect(command.parseHolder(" STARCI ")).toBe(" STARCI ")
        expect(command.parseBind()).toBe(true)
        expect(provisioning.run).not.toHaveBeenCalled()
    })
})
