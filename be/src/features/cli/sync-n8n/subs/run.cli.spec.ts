import { Test } from "@nestjs/testing"
import { N8N_HOST } from "@modules/integrations/n8n-host"
import { mock } from "@starci/jest-preset"
import type { N8nHost } from "@modules/integrations/n8n-host"
import { RunSyncN8nCli } from "./run.cli"

const build = async () => {
    const host = mock<N8nHost>()
    host.sync.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [RunSyncN8nCli, { provide: N8N_HOST, useValue: host }],
    }).compile()
    return { cli: moduleRef.get(RunSyncN8nCli), host }
}

describe("RunSyncN8nCli", () => {
    it("syncs the workflows with the options the command line carries", async () => {
        const { cli, host } = await build()
        const options = { dryRun: true, local: true, restart: false }

        await expect(cli.run([], options)).resolves.toBeUndefined()

        expect(host.sync).toHaveBeenCalledWith(options)
    })

    it("reads each option from the command line", async () => {
        const { cli } = await build()

        expect(cli.parseDryRun()).toBe(true)
        expect(cli.parseLocal()).toBe(true)
        expect(cli.parseRestart()).toBe(false)
    })
})
