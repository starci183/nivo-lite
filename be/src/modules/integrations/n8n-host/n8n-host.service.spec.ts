import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { N8nHostErrorCode } from "./errors/n8n-host.error"
import type { HostCommand, N8nHostShell } from "./n8n-host.contracts"
import { N8N_HOST_OPTIONS, N8N_HOST_SHELL } from "./n8n-host.decorators"
import { N8nHostLogEvent } from "./n8n-host.log-events"
import { N8nHostService } from "./n8n-host.service"

const FILES = [
    { name: "Daily", nodes: [] },
    { name: "Debt", nodes: [] },
]

const build = async (listings: ReadonlyArray<string>, files: ReadonlyArray<unknown> = FILES) => {
    const commands: Array<HostCommand> = []
    let listed = 0
    const shell = mock<N8nHostShell>()
    shell.run.mockImplementation((request) => {
        commands.push(request)
        if (!request.command.includes("list:workflow")) return Promise.resolve("")
        listed += 1
        return Promise.resolve(listings[listed - 1] ?? "")
    })
    shell.workflows.mockResolvedValue(files)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nHostService,
            { provide: N8N_HOST_SHELL, useValue: shell },
            {
                provide: N8N_HOST_OPTIONS,
                useValue: {
                    host: undefined,
                    user: "nivo",
                    sshKey: undefined,
                    knownHosts: undefined,
                    container: "n8n-1",
                },
            },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { host: moduleRef.get(N8nHostService), commands, logger, shell }
}

describe("N8nHostService", () => {
    describe("sync", () => {
        it("plans an update for a known name and a create for a new one, and stops at a dry run", async () => {
            const { host, commands, logger } = await build(["7|Daily"])

            const steps = await host.sync({ dryRun: true, restart: true, local: false })

            expect(steps).toEqual([
                { action: "update", name: "Daily", id: "7" },
                { action: "create", name: "Debt", id: "" },
            ])
            expect(commands).toHaveLength(1)
            expect(logger.info).toHaveBeenCalledWith(N8nHostLogEvent.WorkflowsSynced, { dryRun: true, steps })
        })

        it("imports once, activates each workflow and restarts n8n", async () => {
            const { host, commands } = await build(["7|Daily", "7|Daily\n8|Debt"])

            const steps = await host.sync({ dryRun: false, restart: true, local: true })

            expect(steps).toEqual([
                { action: "update", name: "Daily", id: "7" },
                { action: "create", name: "Debt", id: "" },
                { action: "active", name: "Daily", id: "7" },
                { action: "active", name: "Debt", id: "8" },
                { action: "restart", name: "", id: "" },
            ])
            const imported = commands.find((request) => request.command.includes("import:workflow"))
            expect(imported?.input).toBe(
                '[{"name":"Daily","nodes":[],"id":"7","active":false},{"name":"Debt","nodes":[],"active":false}]',
            )
            expect(imported?.command).toContain("docker exec -i n8n-1 sh -c")
            expect(imported?.command).toContain("umask 077; directory=$(mktemp -d) || exit 1")
            expect(imported?.command).toContain('rm -rf -- "$directory"')
            expect(imported?.command).toContain('cat > "$directory/workflows.json" && n8n import:workflow')
            expect(imported?.command).not.toContain("docker cp")
            expect(commands.every((request) => request.local)).toBe(true)
            expect(commands.map((request) => request.command)).toContain("docker restart n8n-1")
            expect(commands.map((request) => request.command)).toContain(
                "docker exec n8n-1 n8n update:workflow --id=8 --active=true",
            )
        })
    })
})

describe("N8nHostService sync completion and failures", () => {
    describe("sync", () => {
        it("skips the restart when asked", async () => {
            const { host, commands } = await build(["", "1|Daily\n2|Debt"])

            const steps = await host.sync({ dryRun: false, restart: false, local: false })

            expect(steps.map((step) => step.action)).toEqual(["create", "create", "active", "active"])
            expect(commands.map((request) => request.command)).not.toContain("docker restart n8n-1")
        })

        it("fails when a workflow is missing after the import", async () => {
            const { host } = await build(["", "1|Daily"])

            await expect(host.sync({ dryRun: false, restart: true, local: false })).rejects.toMatchObject({
                code: N8nHostErrorCode.WorkflowMissing,
            })
        })

        it("does not activate or restart when importing fails", async () => {
            const { host, commands, shell } = await build(["7|Daily"])
            const failure = new Error("import failed")
            shell.run.mockImplementation((request) => {
                commands.push(request)
                return request.command.includes("import:workflow")
                    ? Promise.reject(failure)
                    : Promise.resolve("7|Daily")
            })

            await expect(host.sync({ dryRun: false, restart: true, local: false })).rejects.toBe(failure)

            expect(commands).toHaveLength(2)
            expect(commands.some((request) => request.command.includes("update:workflow"))).toBe(false)
            expect(commands.some((request) => request.command.includes("docker restart"))).toBe(false)
        })

        it("refuses a sync with nothing to import", async () => {
            const { host } = await build([], [])

            await expect(host.sync({ dryRun: true, restart: true, local: false })).rejects.toMatchObject({
                code: N8nHostErrorCode.NoWorkflows,
            })
        })
    })
})
