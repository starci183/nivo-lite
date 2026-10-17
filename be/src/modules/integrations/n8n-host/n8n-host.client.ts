import { spawn } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import type { Secret } from "@modules/platform/config"
import { N8nHostError, N8nHostErrorCode } from "./errors/n8n-host.error"
import type { HostCommand, N8nHostShell } from "./n8n-host.contracts"
import { InjectN8nHostOptions } from "./n8n-host.decorators"
import type { N8nHostOptions } from "./n8n-host.options"
import { sshArguments } from "./n8n-host.policy"
import { N8N_WORKFLOWS } from "./n8n-host.templates"

const DETAIL_LENGTH = 400

/** OpenSSH refuses a private key file without its final line break, and a materialized secret carries the exact bytes. */
const withTrailingNewline = (text: string): string => (text.endsWith("\n") ? text : `${text}\n`)

@Injectable()
/** The shell of the n8n host as processes: ssh to the VPS, or a local bash when the sync is local. */
export class N8nHostClient implements N8nHostShell {
    constructor(@InjectN8nHostOptions() private readonly options: N8nHostOptions) {}

    /** The shared workflows of `n8n-host.templates.ts`. */
    workflows(): Promise<ReadonlyArray<unknown>> {
        return Promise.resolve(N8N_WORKFLOWS)
    }

    /** Runs the command and answers its standard output; a non-zero exit throws with the start of the output. */
    run(request: HostCommand): Promise<string> {
        if (request.local) return this.runProcess("bash", ["-c", request.command], request)
        if (!this.options.host || this.options.sshKey === undefined)
            throw new N8nHostError({ code: N8nHostErrorCode.HostMissing })
        return this.runRemote(request, this.options.sshKey)
    }

    private async runRemote(request: HostCommand, key: Secret): Promise<string> {
        const directory = await mkdtemp(join(tmpdir(), "nivo-n8n-host-"))
        try {
            const keyPath = join(directory, "id")
            await writeFile(keyPath, withTrailingNewline(key.reveal()), { mode: 0o600 })
            let knownHostsPath: string | undefined
            if (this.options.knownHosts !== undefined) {
                knownHostsPath = join(directory, "known_hosts")
                await writeFile(knownHostsPath, this.options.knownHosts, { mode: 0o600 })
            }
            return await this.runProcess(
                "ssh",
                [...sshArguments(this.options, request.command, keyPath, knownHostsPath)],
                request,
            )
        } finally {
            await rm(directory, { recursive: true, force: true })
        }
    }

    private runProcess(program: string, args: Array<string>, request: HostCommand): Promise<string> {
        const child = spawn(program, args)
        return new Promise<string>((resolve, reject) => {
            const out: Array<string> = []
            const err: Array<string> = []
            child.stdout.on("data", (chunk: Buffer) => out.push(chunk.toString("utf8")))
            child.stderr.on("data", (chunk: Buffer) => err.push(chunk.toString("utf8")))
            child.on("error", reject)
            child.on("close", (status) => {
                if (status === 0) resolve(out.join(""))
                else
                    reject(
                        new N8nHostError({
                            code: N8nHostErrorCode.CommandFailed,
                            params: { detail: (err.join("") || out.join("")).slice(0, DETAIL_LENGTH) },
                        }),
                    )
            })
            child.stdin.end(request.input)
        })
    }
}
