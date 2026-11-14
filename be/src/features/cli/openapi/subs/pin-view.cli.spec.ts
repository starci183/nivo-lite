import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OpenApiToolsOperatorService } from "@modules/domain/data-hub"
import { PinViewOpenApiCli } from "./pin-view.cli"

const build = async () => {
    const operator = mock<OpenApiToolsOperatorService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PinViewOpenApiCli, { provide: OpenApiToolsOperatorService, useValue: operator }],
    }).compile()
    return { command: moduleRef.get(PinViewOpenApiCli), operator }
}

describe("PinViewOpenApiCli", () => {
    it("hands the workspace, the connection and stdout to the operator's view", async () => {
        const { command, operator } = await build()

        await command.run([], { workspace: "ws-1", connection: "conn-1" })

        expect(operator.view.mock.calls).toEqual([[process.stdout, { workspaceId: "ws-1", connectionId: "conn-1" }]])
    })

    it("reads nothing without both flags", async () => {
        const { command, operator } = await build()
        const written = jest.spyOn(process.stdout, "write").mockReturnValue(true)

        await command.run([], { workspace: "ws-1" })

        expect(operator.view).not.toHaveBeenCalled()
        expect(written).toHaveBeenCalledWith(
            expect.stringContaining("--workspace <id> and --connection <id> are required"),
        )
        written.mockRestore()
    })

    it("reads its flags as typed", async () => {
        const { command } = await build()

        expect([command.parseWorkspace("ws-9"), command.parseConnection("conn-9")]).toEqual(["ws-9", "conn-9"])
    })
})
