import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkflowInstallRunService } from "@modules/domain/agent-graphs"
import { InstallWorkflowsCli } from "./install-workflows.cli"

const REPORT = { executed: false, workspaces: 1, agents: 2, added: 3, failed: 0 }

const build = async () => {
    const installs = mock<AgentWorkflowInstallRunService>()
    installs.run.mockResolvedValue(REPORT)
    const moduleRef = await Test.createTestingModule({
        providers: [InstallWorkflowsCli, { provide: AgentWorkflowInstallRunService, useValue: installs }],
    }).compile()
    return { command: moduleRef.get(InstallWorkflowsCli), installs }
}

describe("InstallWorkflowsCli", () => {
    afterEach(() => {
        process.exitCode = 0
    })

    it("is a dry run unless --execute is given, and hands the flags as typed", async () => {
        const { command, installs } = await build()

        await command.run([])
        await command.run([], { execute: true, workspace: "ws-1" })

        expect(installs.run.mock.calls).toEqual([
            [process.stdout, { execute: undefined, workspaceId: undefined }],
            [process.stdout, { execute: true, workspaceId: "ws-1" }],
        ])
        expect(process.exitCode ?? 0).toBe(0)
    })

    it("ends non-zero when the install of any agent failed, though the others were done", async () => {
        const { command, installs } = await build()
        installs.run.mockResolvedValue({ ...REPORT, executed: true, failed: 1 })

        await command.run([], { execute: true })

        expect(process.exitCode).toBe(1)
    })

    it("propagates a failure of the run itself, and reads its flags", async () => {
        const { command, installs } = await build()
        const failure = new Error("database unavailable")
        installs.run.mockRejectedValue(failure)

        await expect(command.run([], {})).rejects.toBe(failure)
        expect(command.parseExecute()).toBe(true)
        expect(command.parseWorkspace("ws-9")).toBe("ws-9")
    })
})
