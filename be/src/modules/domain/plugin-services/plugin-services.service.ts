import { Injectable } from "@nestjs/common"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { serviceOf, type ServiceContract, type ServiceDefinition } from "@nivo-lite/agent-sdk/service"
import {
    EntityEngineService,
    ModuleAgentService,
    type AgentScope,
    type RunIn,
    type ScopedTx,
} from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPluginServicePorts, InjectPluginServicesOptions } from "./plugin-services.decorators"
import type { PluginModuleServiceScope, PluginServicePorts, PluginServiceRun, PluginServiceScope } from "./plugin-services.contracts"
import type { PluginServiceCatalog, PluginServicesOptions } from "./plugin-services.options"
import { PluginServicesError, PluginServicesErrorCode } from "./errors/plugin-services.error"

/** The service found for an agent: its definition and the scope its records are reached in. */
interface Resolved<T> {
    readonly definition: ServiceDefinition<T>
    readonly agent: AgentScope
}

@Injectable()
/**
 * The engine's one way to the business code a plugin ships: the installed SERVICE that implements a contract the engine knows, for the
 * module of one agent. The engine never imports the plugin; it asks for the contract, and the service is built over the same ports a
 * read or an action names, provided by the port host the composition root binds (the workbench door's `DoorPortsService`) for a "system run for this agent": its entity calls run
 * in the engine scope of the workspace stamped with, and (by default) confined to, the agent, so a record the service writes is that
 * agent's, never another's, never an agent-less one. A caller that already holds an engine transaction passes it (`transaction`) and the
 * service's writes join it; `within` runs a callback in ONE new transaction.
 */
export class PluginServicesService {
    private readonly catalog: PluginServiceCatalog

    constructor(
        @InjectPluginServicesOptions() options: PluginServicesOptions,
        @InjectClock() private readonly clock: Clock,
        private readonly installations: InstallationRecordsService,
        private readonly agents: ModuleAgentService,
        private readonly engine: EntityEngineService,
        @InjectPluginServicePorts() private readonly ports: PluginServicePorts,
        private readonly zones: WorkspaceTimeZoneService,
    ) {
        this.catalog = options.catalog
    }

    /**
     * The implementation of `contract` that the module of agent `scope.agentId` ships, built for the scope. Throws `AgentUnknown` for an
     * agent that is no installed agent of the workspace, `ServiceMissing` when no installed plugin ships the contract for its module,
     * and `ScopeMismatch` when `scope.transaction` is of another workspace or acts for another agent.
     */
    async of<T>(contract: ServiceContract<T>, scope: PluginServiceScope): Promise<T> {
        const resolved = await this.resolve(contract, scope.workspaceId, scope.agentId, scope)
        return this.built(resolved, scope.workspaceId, scope)
    }

    /**
     * Like `of`, for a caller that holds a module: the agent is the one `ModuleAgentService.scopeOf` derives (the installation's, else the
     * module's oldest installation's; a module with no installed agent refuses with the entity engine's `AgentMissing`).
     */
    async forModule<T>(contract: ServiceContract<T>, scope: PluginModuleServiceScope): Promise<T> {
        const agent = await this.agents.scopeOf(scope.workspaceId, scope.moduleKey, scope.installationId)
        return this.of(contract, { ...scope, agentId: agent.id })
    }

    /** The module whose plugin ships a service of `contract` (the first in installation order); null when no installed plugin does. */
    moduleKeyOf<T>(contract: ServiceContract<T>): string | null {
        return this.catalog.services?.().find((definition) => definition.contract.id === contract.id)?.moduleKey ?? null
    }

    /**
     * Like `within`, for a caller that holds a contract and no agent: the agent is the one `ModuleAgentService.scopeOf` derives for the
     * module that ships the contract (its oldest installation), and the scope sees the whole workspace unless `sees` says otherwise. For
     * reads that no agent owns. No installed plugin shipping the contract refuses with `ServiceMissing`; a module with no installed agent
     * refuses with the entity engine's `AgentMissing`.
     */
    async withinContract<T, R>(
        contract: ServiceContract<T>,
        scope: Omit<PluginServiceScope, "agentId" | "transaction">,
        work: (service: T, transaction: ScopedTx) => Promise<R>,
    ): Promise<R> {
        const moduleKey = this.moduleKeyOf(contract)
        if (moduleKey === null) {
            throw new PluginServicesError({
                code: PluginServicesErrorCode.ServiceMissing,
                params: { contract: contract.id, module: "" },
            })
        }
        const agent = await this.agents.scopeOf(scope.workspaceId, moduleKey)
        return this.within(contract, { ...scope, agentId: agent.id, sees: scope.sees ?? "all" }, work)
    }

    /**
     * Runs `work` with the service in ONE new engine transaction scoped to the agent: every entity call of the service commits or rolls
     * back together with whatever else `work` does through it. For a caller that holds no transaction and needs several writes to be atomic.
     */
    async within<T, R>(
        contract: ServiceContract<T>,
        scope: Omit<PluginServiceScope, "transaction">,
        work: (service: T, transaction: ScopedTx) => Promise<R>,
    ): Promise<R> {
        const resolved = await this.resolve(contract, scope.workspaceId, scope.agentId, scope)
        return this.engine.scoped(
            scope.workspaceId,
            async (transaction) => work(await this.built(resolved, scope.workspaceId, { ...scope, transaction }), transaction),
            resolved.agent,
        )
    }

    private async resolve<T>(
        contract: ServiceContract<T>,
        workspaceId: string,
        agentId: string,
        run: PluginServiceRun,
    ): Promise<Resolved<T>> {
        const installation = await this.installations.ofAgent(workspaceId, agentId)
        if (installation === null || installation.status === "removed") {
            throw new PluginServicesError({ code: PluginServicesErrorCode.AgentUnknown, params: { agentId, workspaceId } })
        }
        const definition = this.catalog.serviceFor(contract, installation.moduleKey)
        if (definition === null) {
            throw new PluginServicesError({
                code: PluginServicesErrorCode.ServiceMissing,
                params: { contract: contract.id, module: installation.moduleKey },
            })
        }
        return { definition, agent: { id: agentId, sees: run.sees ?? "own" } }
    }

    private async built<T>(resolved: Resolved<T>, workspaceId: string, run: PluginServiceRun): Promise<T> {
        const memberId = run.memberId ?? null
        const locale = run.locale ?? "vi"
        const runIn = this.runInOf(workspaceId, resolved.agent, run.transaction)
        const context: RunContext = {
            workspaceId,
            memberId,
            now: this.clock.now(),
            timeZone: await this.zones.timeZoneOf(workspaceId),
            locale,
        }
        const provider = this.ports.providerFor({
            workspaceId,
            runIn,
            name: resolved.definition.id,
            dataKind: null,
            memberId,
            locale,
            fields: [],
        })
        return serviceOf(resolved.definition, provider, context)
    }

    /**
     * Where the service's entity calls run: in the caller's transaction when it was given (it must be of this workspace and act for this
     * agent, or an agent-less transaction would refuse every write far from the cause), else each call in a scope of its own, as the agent.
     */
    private runInOf(workspaceId: string, agent: AgentScope, transaction: ScopedTx | undefined): RunIn {
        if (transaction === undefined) return (use) => this.engine.scoped(workspaceId, use, agent)
        if (transaction.workspaceId !== workspaceId || transaction.agent?.id !== agent.id) {
            throw new PluginServicesError({
                code: PluginServicesErrorCode.ScopeMismatch,
                params: { workspaceId, agentId: agent.id },
            })
        }
        return (use) => use(transaction)
    }
}
