import { Injectable, Module, type DynamicModule } from "@nestjs/common"
import {
    AgentGraphsModule,
    type FactSpec,
    type FactSubject,
    type FactValues,
    type GraphFactReader,
} from "@modules/domain/agent-graphs"
import { ProposalsProofModule } from "./agent-graph-proposals-proof.module"
import { EventsModule } from "@modules/domain/events"
import { StaffModule } from "@modules/domain/staff"
import { WorkspaceMembersModule } from "@modules/domain/workspace-members"
import { AMOUNT_FACT } from "../fixtures/builders/agent-graph.builder"
import { ENGINE_STORE_MODULE } from "./entity-engine-store.options"
import { QUEUE_MODULES } from "./test-capabilities.options"

const AMOUNT: FactSpec = {
    key: AMOUNT_FACT,
    type: "number",
    unit: "vnd",
    labelKey: "agentGraphs.fact.supplier_payment.amount_vnd",
}

@Injectable()
/** The books of the proof: the amount of a payment by the record the work names, set by the scenario that needs it. */
export class BooksReader implements GraphFactReader {
    readonly facts: ReadonlyArray<FactSpec> = [AMOUNT]
    readonly amounts: Map<string, number> = new Map<string, number>()

    read(_workspaceId: string, subject: FactSubject): Promise<FactValues> {
        const amount = this.amounts.get(subject.id)
        return Promise.resolve(amount === undefined ? {} : { [AMOUNT_FACT]: amount })
    }
}

@Module({})
class BooksProofModule {
    static register(): DynamicModule {
        return { module: BooksProofModule, global: true, providers: [BooksReader], exports: [BooksReader] }
    }
}

/** The branch decider over the real graph store and the real decision ledger, with the books of the proof as the only reader. */
export const AGENT_GRAPH_DECIDER_MODULES: ReadonlyArray<DynamicModule> = [
    ...QUEUE_MODULES,
    ENGINE_STORE_MODULE,
    EventsModule.register({ isGlobal: true }),
    StaffModule.register({ isGlobal: true }),
    WorkspaceMembersModule.register({ isGlobal: true }),
    BooksProofModule.register(),
    AgentGraphsModule.register({ isGlobal: true, deciderOnly: true, readers: [BooksReader] }),
]

/** The graph store as the apps that edit graphs use it: the decider's modules with the proposals the owner decides. */
export const AGENT_GRAPH_STORE_MODULES: ReadonlyArray<DynamicModule> = [
    ...AGENT_GRAPH_DECIDER_MODULES,
    ProposalsProofModule.register(),
]
