import { Injectable } from "@nestjs/common"
import type { NivoApiVerb } from "@nivo-lite/agent-sdk/names"
import { InjectNivoApiOpGroups } from "./nivo-api.decorators"
import type { NivoApiOpGroup, NivoApiOpLookup, NivoApiOpTable } from "./nivo-api-ops.contracts"
import { nivoApiOpTableOf } from "./nivo-api-ops.policy"

@Injectable()
/** The registry of the NIVO data ops: every feature declares its messages into a group, the app lists the groups, the executor reads this. */
export class NivoApiOpsService {
    private readonly table: NivoApiOpTable

    constructor(@InjectNivoApiOpGroups() groups: ReadonlyArray<NivoApiOpGroup>) {
        this.table = nivoApiOpTableOf(groups)
    }

    /** The registered op of an exposed name; null for a name no group declares (not exposed). */
    opOf(name: NivoApiVerb): NivoApiOpLookup {
        return this.table.ops.get(name) ?? null
    }
}
