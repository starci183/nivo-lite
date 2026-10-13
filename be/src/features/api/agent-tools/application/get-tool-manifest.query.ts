import { Query } from "@nestjs/cqrs"
import type { ToolManifestEntry } from "@modules/domain/agent-tools"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { GetToolManifestRequest } from "./get-tool-manifest.contracts"

/** Asks for the tools OpenClaw may call. */
export class GetToolManifestQuery extends Query<ReadonlyArray<ToolManifestEntry>> {
    constructor(readonly params: PublicExecuteParams<GetToolManifestRequest>) {
        super()
    }
}
