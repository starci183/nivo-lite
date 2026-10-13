import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { N8nHostErrorCode } from "./errors/n8n-host.error"
import { N8nHostClient } from "./n8n-host.client"
import type { N8nHostOptions } from "./n8n-host.options"

const OPTIONS: N8nHostOptions = {
    host: undefined,
    user: "nivo",
    keyPath: "/keys/id",
    knownHostsPath: undefined,
    container: "n8n-1",
    root: "resources",
}

const local = (command: string, input = "") => ({ command, input, local: true })

describe("N8nHostClient", () => {
    describe("run", () => {
        it("answers the output of a local command and feeds it the input", async () => {
            const client = new N8nHostClient(OPTIONS)

            await expect(client.run(local("cat", "hello"))).resolves.toBe("hello")
        })

        it("fails with the start of the error output when a local command ends with an error", async () => {
            const client = new N8nHostClient(OPTIONS)

            await expect(client.run(local("echo broken >&2; exit 3"))).rejects.toMatchObject({
                code: N8nHostErrorCode.CommandFailed,
                params: { detail: "broken\n" },
            })
        })

        it("falls back on the standard output for the detail of a failure", async () => {
            const client = new N8nHostClient(OPTIONS)

            await expect(client.run(local("echo said; exit 1"))).rejects.toMatchObject({
                params: { detail: "said\n" },
            })
        })

        it("refuses a remote command when no host is configured", () => {
            const client = new N8nHostClient(OPTIONS)

            expect(() => client.run({ command: "ls", input: "", local: false })).toThrow(
                expect.objectContaining({ code: N8nHostErrorCode.HostMissing }),
            )
        })

        it("fails when the ssh program cannot reach the host", async () => {
            const client = new N8nHostClient({ ...OPTIONS, host: "127.0.0.1", keyPath: "/nonexistent-key" })

            await expect(client.run({ command: "ls", input: "", local: false })).rejects.toBeDefined()
        })
    })

    describe("workflows", () => {
        let root: string

        beforeEach(async () => {
            root = await mkdtemp(join(tmpdir(), "n8n-host-"))
            await mkdir(join(root, "n8n-templates"))
            await writeFile(join(root, "n8n-templates", "b.json"), '{"name":"B","nodes":[]}')
            await writeFile(join(root, "n8n-templates", "a.json"), '{"name":"A","nodes":[]}')
            await writeFile(join(root, "n8n-templates", "a.meta.json"), '{"key":"a"}')
            await writeFile(join(root, "n8n-templates", "notes.txt"), "no")
        })

        afterEach(async () => {
            await rm(root, { recursive: true, force: true })
        })

        it("reads the workflow files in name order and leaves the meta files out", async () => {
            const client = new N8nHostClient({ ...OPTIONS, root })

            await expect(client.workflows()).resolves.toEqual([
                { name: "A", nodes: [] },
                { name: "B", nodes: [] },
            ])
        })

        it("names the file that is not valid json", async () => {
            await writeFile(join(root, "n8n-templates", "c.json"), "{broken")
            const client = new N8nHostClient({ ...OPTIONS, root })

            await expect(client.workflows()).rejects.toMatchObject({
                code: N8nHostErrorCode.WorkflowInvalid,
                params: { file: "c.json" },
            })
        })
    })
})
