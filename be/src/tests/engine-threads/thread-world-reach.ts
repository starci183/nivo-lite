import type { Provider } from "@nestjs/common"
import { mock } from "@starci/jest-preset"
import { AgentNodeRoutesService } from "@modules/domain/agent-graphs"
import { AgentWorkflowTriggerReceiversService } from "@modules/domain/agent-graphs/agent-workflow-trigger-receivers.service"
import { WorkflowCallReachService } from "@modules/domain/agents"
import { AGENTS_CHANNEL_OWNERS, AGENTS_INSTALLATIONS } from "@modules/domain/agents/agents.decorators"
import type { ConversationChannelOwners, InstallationDirectory } from "@modules/domain/agents/agents.port"
import { GRAPH_NODE_ROUTES } from "@modules/domain/graph-nodes"
import { PROVIDER_TRIGGER_RECEIVERS } from "@modules/domain/provider-triggers"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { agentInstallationOf } from "@tests/fixtures/builders/agents.builder"
import { WS } from "./thread-world-records"
import type { ThreadDb } from "./thread-world-process"

// THE ENGINE'S REACH OF A WORKFLOW CALL IN THE WORLD (E-SMALL item 1): the REAL `AgentNodeRoutesService` (the routes a step cannot follow,
// read from the pinned graph the world stores) bound as the node host's `GRAPH_NODE_ROUTES`, over the REAL `WorkflowCallReachService` and
// the REAL MATCH reader (`AgentWorkflowTriggerReceiversService` over the world's seeded workflows). The only doubles: the installation
// directory (the agents the database's `modules` names, by module) and the channel owners (none: the oldest agent of a module answers).

/** The providers that give a process the engine's `run.unreachable`; `modules` maps each installed agent id to its module key. */
export const reachProvidersOf = (db: ThreadDb, modules: Readonly<Record<string, string>>): ReadonlyArray<Provider> => {
    const installations = mock<InstallationDirectory>({
        firstOfModule: (workspaceId: string, module: string) => {
            const agentId = Object.entries(modules).find(([, key]) => key === module)?.[0]
            return Promise.resolve(
                agentId === undefined || workspaceId !== WS ? null : agentInstallationOf({ agentId, module, workspaceId }),
            )
        },
    })
    const owners = mock<ConversationChannelOwners>({ ownerAgentOf: () => Promise.resolve(null) })
    const attachments = mock<AccountAttachmentsService>({ listOfWorkspace: () => Promise.resolve(db.rights.attachments) })
    return [
        { provide: AGENTS_INSTALLATIONS, useValue: installations },
        { provide: AGENTS_CHANNEL_OWNERS, useValue: owners },
        { provide: PROVIDER_TRIGGER_RECEIVERS, useValue: new AgentWorkflowTriggerReceiversService(attachments, db.workflows.service) },
        WorkflowCallReachService,
        AgentNodeRoutesService,
        { provide: GRAPH_NODE_ROUTES, useExisting: AgentNodeRoutesService },
    ]
}
