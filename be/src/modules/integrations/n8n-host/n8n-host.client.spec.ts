import { Test } from "@nestjs/testing"
import { N8N_HOST_OPTIONS } from "./n8n-host.decorators"
import childProcess, { ChildProcess } from "node:child_process"
import fsPromises from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { PassThrough } from "node:stream"
import { Secret } from "@modules/platform/config"
import { N8nHostError, N8nHostErrorCode } from "./errors/n8n-host.error"
import { N8nHostClient } from "./n8n-host.client"
import type { HostCommand } from "./n8n-host.contracts"
import type { N8nHostOptions } from "./n8n-host.options"
import { N8N_WORKFLOWS } from "./n8n-host.templates"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A sub-array matcher, typed `unknown` so it flows into any slot. */
const arrayLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const OPTIONS: N8nHostOptions = {
    host: undefined,
    user: "nivo",
    sshKey: undefined,
    knownHosts: undefined,
    container: "n8n-1",
}

const KEY_CONTENT = "  fake-private-key\n"
const REMOTE_OPTIONS: N8nHostOptions = { ...OPTIONS, host: "vps.example", sshKey: new Secret(KEY_CONTENT) }
const DIRECTORY = join(tmpdir(), "nivo-n8n-host-spec")
const remote: HostCommand = { command: "docker ps", input: "workflow", local: false }
const local = (command: string, input = ""): HostCommand => ({ command, input, local: true })

const build = async (options: N8nHostOptions = OPTIONS) => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    const stdin = new PassThrough()
    const child = Object.assign(new ChildProcess(), { stdout, stderr, stdin })
    const spawn = jest.spyOn(childProcess, "spawn")
    const started = new Promise<void>((resolve) => {
        spawn.mockImplementation(() => {
            resolve()
            return child
        })
    })
    const mkdtemp = jest.spyOn(fsPromises, "mkdtemp").mockResolvedValue(DIRECTORY)
    const writeFile = jest.spyOn(fsPromises, "writeFile").mockResolvedValue(undefined)
    const rm = jest.spyOn(fsPromises, "rm").mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [N8nHostClient, { provide: N8N_HOST_OPTIONS, useValue: { ...options } }],
    }).compile()
    return {
        client: moduleRef.get(N8nHostClient),
        child,
        stdout,
        stderr,
        stdin,
        started,
        spawn,
        mkdtemp,
        writeFile,
        rm,
    }
}

describe("N8nHostClient run", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })
    it("answers local output and feeds input without a host, key or temporary files", async () => {
        const { client, child, stdout, stdin, spawn, mkdtemp, writeFile, rm } = await build()

        const running = client.run(local("cat", "hello"))
        stdout.emit("data", Buffer.from("hel"))
        stdout.emit("data", Buffer.from("lo"))
        child.emit("close", 0)

        await expect(running).resolves.toBe("hello")
        expect(stdin.read()).toEqual(Buffer.from("hello"))
        expect(spawn).toHaveBeenCalledWith("bash", ["-c", "cat"])
        expect(mkdtemp).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
        expect(rm).not.toHaveBeenCalled()
    })

    it("fails with the first 400 characters of error output on a non-zero exit", async () => {
        const { client, child, stdout, stderr } = await build()

        const running = client.run(local("failed"))
        stdout.emit("data", Buffer.from("ignored"))
        stderr.emit("data", Buffer.from("x".repeat(300)))
        stderr.emit("data", Buffer.from("y".repeat(200)))
        child.emit("close", 3)

        await expect(running).rejects.toMatchObject({
            code: N8nHostErrorCode.CommandFailed,
            params: { detail: `${"x".repeat(300)}${"y".repeat(100)}` },
        })
    })

    it("uses standard output for failure details when no error output was printed", async () => {
        const { client, child, stdout } = await build()

        const running = client.run(local("failed"))
        stdout.emit("data", Buffer.from("said\n"))
        child.emit("close", 1)

        await expect(running).rejects.toMatchObject({ params: { detail: "said\n" } })
    })

    it("fails when the local process emits an error", async () => {
        const { client, child } = await build()
        const failure = new Error("could not start bash")

        const running = client.run(local("cat"))
        child.emit("error", failure)

        await expect(running).rejects.toBe(failure)
    })

    it.each([
        { ...REMOTE_OPTIONS, host: undefined },
        { ...REMOTE_OPTIONS, sshKey: undefined },
    ])("refuses an unconfigured remote command without creating files", async (options) => {
        const { client, spawn, mkdtemp } = await build(options)

        expect(thrownBy(() => client.run(remote))).toEqual(objectLike({ code: N8nHostErrorCode.HostMissing }))
        expect(spawn).not.toHaveBeenCalled()
        expect(mkdtemp).not.toHaveBeenCalled()
    })
})
describe("N8nHostClient run", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })
    it("uses exact private-key bytes with mode 0600 until SSH finishes, then removes the directory", async () => {
        const { client, child, stdout, stdin, started, spawn, mkdtemp, writeFile, rm } = await build(REMOTE_OPTIONS)

        const running = client.run(remote)
        await started

        expect(mkdtemp).toHaveBeenCalledWith(join(tmpdir(), "nivo-n8n-host-"))
        expect(writeFile.mock.calls).toEqual([[join(DIRECTORY, "id"), KEY_CONTENT, { mode: 0o600 }]])
        expect(spawn).toHaveBeenCalledWith("ssh", [
            "-i",
            join(DIRECTORY, "id"),
            "-o",
            "BatchMode=yes",
            "-o",
            "StrictHostKeyChecking=accept-new",
            "nivo@vps.example",
            "docker ps",
        ])
        expect(stdin.read()).toEqual(Buffer.from("workflow"))
        expect(rm).not.toHaveBeenCalled()
        stdout.emit("data", Buffer.from("done"))
        child.emit("close", 0)

        await expect(running).resolves.toBe("done")
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })

    it("ends a private key that has no final line break with one, as OpenSSH requires", async () => {
        const bare = { ...REMOTE_OPTIONS, sshKey: new Secret("fake-private-key") }
        const { client, child, started, writeFile } = await build(bare)

        const running = client.run(remote)
        await started

        expect(writeFile.mock.calls).toEqual([[join(DIRECTORY, "id"), "fake-private-key\n", { mode: 0o600 }]])
        child.emit("close", 0)
        await running
    })

    it("writes exact known-hosts content and passes its temporary file to SSH", async () => {
        const knownHosts = "vps.example fake-host-key\n"
        const { client, child, started, spawn, writeFile, rm } = await build({ ...REMOTE_OPTIONS, knownHosts })

        const running = client.run(remote)
        await started
        child.emit("close", 0)

        await expect(running).resolves.toBe("")
        expect(writeFile.mock.calls).toEqual([
            [join(DIRECTORY, "id"), KEY_CONTENT, { mode: 0o600 }],
            [join(DIRECTORY, "known_hosts"), knownHosts, { mode: 0o600 }],
        ])
        expect(spawn).toHaveBeenCalledWith(
            "ssh",
            arrayLike(["-o", `UserKnownHostsFile=${join(DIRECTORY, "known_hosts")}`]),
        )
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })
})
describe("N8nHostClient run", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })
    it("removes the directory when SSH exits without a status", async () => {
        const { client, child, started, rm } = await build(REMOTE_OPTIONS)

        const running = client.run(remote)
        await started
        child.emit("close", null)

        await expect(running).rejects.toMatchObject({
            code: N8nHostErrorCode.CommandFailed,
            params: { detail: "" },
        })
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })

    it("removes the directory when SSH emits an error", async () => {
        const { client, child, started, rm } = await build(REMOTE_OPTIONS)
        const failure = new Error("could not start ssh")

        const running = client.run(remote)
        await started
        child.emit("error", failure)

        await expect(running).rejects.toBe(failure)
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })

    it("removes the directory when spawning SSH throws", async () => {
        const { client, spawn, rm } = await build(REMOTE_OPTIONS)
        const failure = new N8nHostError({ code: N8nHostErrorCode.CommandFailed })
        spawn.mockImplementation(() => {
            throw failure
        })

        await expect(client.run(remote)).rejects.toBe(failure)
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })

    it.each(["key", "known hosts"])("removes the directory when writing %s fails", async (file) => {
        const { client, spawn, writeFile, rm } = await build({ ...REMOTE_OPTIONS, knownHosts: "fake-host-key\n" })
        const failure = new Error("write failed")
        if (file === "known hosts") writeFile.mockResolvedValueOnce(undefined)
        writeFile.mockRejectedValueOnce(failure)

        await expect(client.run(remote)).rejects.toBe(failure)
        expect(spawn).not.toHaveBeenCalled()
        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
    })

    it("fails without removing a directory when temporary-directory creation fails", async () => {
        const { client, mkdtemp, writeFile, spawn, rm } = await build(REMOTE_OPTIONS)
        const failure = new Error("could not create directory")
        mkdtemp.mockRejectedValueOnce(failure)

        await expect(client.run(remote)).rejects.toBe(failure)
        expect(writeFile).not.toHaveBeenCalled()
        expect(spawn).not.toHaveBeenCalled()
        expect(rm).not.toHaveBeenCalled()
    })
})
describe("N8nHostClient run", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })
    it("waits for the temporary directory to be removed before finishing", async () => {
        const { client, child, started, rm } = await build(REMOTE_OPTIONS)
        const cleanupResolvers: Array<() => void> = []
        const cleaned = new Promise<void>((resolve) => {
            cleanupResolvers.push(resolve)
        })
        rm.mockReturnValueOnce(cleaned)
        let completed = false

        const running = client.run(remote).then(() => {
            completed = true
        })
        await started
        child.emit("close", 0)
        await Promise.resolve()

        expect(rm).toHaveBeenCalledWith(DIRECTORY, { recursive: true, force: true })
        expect(completed).toBe(false)
        expect(cleanupResolvers).toHaveLength(1)
        cleanupResolvers[0]?.()
        await running
        expect(completed).toBe(true)
    })
})
describe("N8nHostClient workflows", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })
    it("answers the shared workflows of the templates file, each with a name and nodes", async () => {
        const { client } = await build()

        const workflows = await client.workflows()

        expect(workflows).toBe(N8N_WORKFLOWS)
        expect(workflows.length).toBeGreaterThan(0)
    })
})
