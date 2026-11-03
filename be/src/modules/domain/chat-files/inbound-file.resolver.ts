import { lookup } from "node:dns/promises"
import { Injectable } from "@nestjs/common"
import type { HttpPin } from "@modules/platform/http"

/** Finds the addresses a host name stands for, so a download can refuse a name that points inside the network and connect to the address it checked. */
export interface HostResolver {
    /** Every address of the host as a connection target; an empty list when the name does not resolve. */
    resolve(host: string): Promise<ReadonlyArray<HttpPin>>
}

@Injectable()
/** Resolves host names with the system resolver. */
export class NodeHostResolver implements HostResolver {
    /** Every address of the host as a connection target; an empty list when the name does not resolve. */
    async resolve(host: string): Promise<ReadonlyArray<HttpPin>> {
        const answers = await lookup(host, { all: true }).catch(() => [])
        return answers.map((answer) => ({ address: answer.address, family: answer.family === 6 ? 6 : 4 }))
    }
}
