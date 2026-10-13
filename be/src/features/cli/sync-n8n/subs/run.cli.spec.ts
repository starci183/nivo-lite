import { mock } from "@starci/jest-preset"
import type { N8nHost } from "@modules/integrations/n8n-host"
import { RunSyncN8nCli } from "./run.cli"

const build = () => {
    const host = mock<N8nHost>()
    host.sync.mockResolvedValue([])
    return { cli: new RunSyncN8nCli(host), host }
}

describe("RunSyncN8nCli", () => {
    it("syncs the workflows with the options the command line carries", async () => {
        const { cli, host } = build()
        const options = { dryRun: true, local: true, restart: false }

        await expect(cli.run([], options)).resolves.toBeUndefined()

        expect(host.sync).toHaveBeenCalledWith(options)
    })

    it("reads each option from the command line", () => {
        const { cli } = build()

        expect(cli.parseDryRun()).toBe(true)
        expect(cli.parseLocal()).toBe(true)
        expect(cli.parseRestart()).toBe(false)
    })
})
