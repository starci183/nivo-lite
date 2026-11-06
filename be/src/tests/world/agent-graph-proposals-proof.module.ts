import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentGraphProposalsService } from "../../modules/domain/agent-graphs/agent-graph-proposals.service"

@Module({})
/** The proposals of the graphs, which the decider's modules leave out, for a proof that raises and reads them. */
export class ProposalsProofModule {
    static register(): DynamicModule {
        return {
            module: ProposalsProofModule,
            global: true,
            providers: [AgentGraphProposalsService],
            exports: [AgentGraphProposalsService],
        }
    }
}
