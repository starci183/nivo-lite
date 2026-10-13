import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RecordManualEvidenceCommand } from "../../application/record-manual-evidence.command"
import { RecordManualEvidenceInput } from "./dto/record-manual-evidence.input"
import { ManualEvidenceType } from "./dto/manual-evidence.type"
import { toRecordManualEvidenceRequest, toRecordManualEvidenceType } from "./record-manual-evidence.mapper"

@Resolver()
/** GraphQL door of admits one piece of manual evidence: money the owner knows arrived. */
export class RecordManualEvidenceResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Admits one piece of manual evidence: money the owner knows arrived. */
    @Mutation(() => ManualEvidenceType, { name: "recordManualEvidence" })
    async recordManualEvidence(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RecordManualEvidenceInput,
    ): Promise<ManualEvidenceType> {
        const result = await this.commandBus.execute(new RecordManualEvidenceCommand({ request: toRecordManualEvidenceRequest(workspaceId, input), principal }))
        return toRecordManualEvidenceType(result)
    }
}
