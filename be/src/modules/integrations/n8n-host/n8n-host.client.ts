import { spawn } from "node:child_process"
import { Injectable } from "@nestjs/common"
import { N8nHostError, N8nHostErrorCode } from "./errors/n8n-host.error"
import type { HostCommand, N8nHostShell } from "./n8n-host.contracts"
import { InjectN8nHostOptions } from "./n8n-host.decorators"
import type { N8nHostOptions } from "./n8n-host.options"
import { sshArguments } from "./n8n-host.policy"
import { N8N_WORKFLOWS } from "./n8n-host.templates"

const DETAIL_LENGTH = 400

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
        if (!request.local && !this.options.host) throw new N8nHostError({ code: N8nHostErrorCode.HostMissing })
        const child = request.local
            ? spawn("bash", ["-c", request.command])
            : spawn("ssh", [...sshArguments(this.options, request.command)])
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
