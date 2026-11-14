import { Injectable, Optional } from "@nestjs/common"
import { WorkspaceEnterpriseService, WorkspaceLobbyService, WorkspacesService } from "@modules/domain/workspaces"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectChannelProvisioningOptions } from "./channel-provisioning.decorators"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"
import { InjectEnterpriseRoster, type EnterpriseRoster } from "./enterprise-roster.port"
import type { EnterpriseSeed, EnterpriseSeedPlace } from "./enterprise-seed.contracts"
import { placeOf, readEnterpriseSeeds, targetIncludes } from "./enterprise-seed.policy"
import { invalid } from "./management-seed.policy"

/** The most workspaces looked through for a named one. */
const WORKSPACE_SCAN_LIMIT = 1000

/** The last line the stack seed step reads as "nothing changed". */
const UNCHANGED = "unchanged"

/** A workspace as the seed finds it by name. */
interface NamedWorkspace {
    readonly id: string
    readonly name: string
}

@Injectable()
/**
 * The seed of the enterprise workspaces: FOUNDATION data only, one document per enterprise (`nivo-web` first), each with its `target`
 * (`off`, `local`, `prod`, `both`; dev is local, production is prod) read on every run. In an environment its target leaves out it reads
 * and writes nothing; in one it includes, it ensures the enterprise's workspace, owned by the owner of the workspace it names, and gives it
 * its string identifier, then installs its ROSTER (the agents its private plugins declare: `EnterpriseRoster`, when the app binds one). A
 * rerun finds the workspace and the roster in place and answers `unchanged`. Usage data (the CRM import of customer files, conversations,
 * runs, documents) is never seeded: moving an enterprise to production seeds the same foundation there and runs its own imports again;
 * nothing made on the local stack travels. `remove` takes an enterprise off the local stack, by hand only.
 */
export class EnterpriseSeedService {
    constructor(
        @InjectChannelProvisioningOptions() private readonly options: ChannelProvisioningOptions,
        private readonly workspaces: WorkspacesService,
        private readonly lobby: WorkspaceLobbyService,
        private readonly enterprise: WorkspaceEnterpriseService,
        @Optional() @InjectEnterpriseRoster() private readonly roster?: EnterpriseRoster,
    ) {}

    /** Applies every enterprise read from `text` in the environment; a refused document stops the run before anything is written. */
    async run(text: string, environment: string): Promise<void> {
        const place = placeOf(environment)
        const seeds = readEnterpriseSeeds(text)
        let isChanged = false
        await eachInOrder(seeds, async (seed) => {
            if (!targetIncludes(seed.target, place)) {
                this.options.print(`${seed.identifier}: target is ${seed.target}: nothing seeded on ${environment}`)
                return
            }
            isChanged = (await this.apply(seed, place)) || isChanged
        })
        this.options.print(isChanged ? "applied" : UNCHANGED)
    }

    /**
     * Takes the enterprises of the documents off the local stack after their target moved away from it: prints what goes and, only with
     * `execute`, removes it through the owner's own delete door. Refused in production and while a target still seeds the environment.
     * Never run by the seed step.
     */
    async remove(text: string, environment: string, execute: boolean): Promise<void> {
        if (placeOf(environment) === "prod") {
            this.options.print(`remove never runs in ${environment}`)
            return invalid("env")
        }
        const seeds = readEnterpriseSeeds(text)
        const seeding = seeds.find((seed) => targetIncludes(seed.target, "local"))
        if (seeding !== undefined) {
            this.options.print(
                `${seeding.identifier}: target is ${seeding.target}: it still seeds ${environment}; move it to prod or off first`,
            )
            return invalid("target")
        }
        await eachInOrder(seeds, (seed) => this.removeOne(seed, environment, execute))
    }

    /** Ensures the workspace of one enterprise, its identifier and its roster; answers whether anything changed. */
    private async apply(seed: EnterpriseSeed, place: EnterpriseSeedPlace): Promise<boolean> {
        const named = await this.workspaces.list(WORKSPACE_SCAN_LIMIT)
        const ownerId = await this.ownerOf(named, seed.ownerWorkspace)
        const isHeld = (await this.ownedLive(named, seed.workspaceName, ownerId)).length > 0
        const { id } = await this.workspaces.ensureNamed(ownerId, seed.workspaceName)
        this.options.print(`${seed.identifier}: workspace ${id} ${isHeld ? "kept" : "created"}`)
        const { from, to } = await this.enterprise.set(id, seed.identifier)
        this.options.print(`${seed.identifier}: enterprise identifier ${from === to ? "kept" : "set"}`)
        const rostered = (await this.roster?.install({ workspaceId: id, ownerId, identifier: seed.identifier, place })) ?? false
        return !isHeld || from !== to || rostered
    }

    /** Prints the plan for one enterprise's workspace and, with `execute`, deletes it as its owner. */
    private async removeOne(seed: EnterpriseSeed, environment: string, execute: boolean): Promise<void> {
        const named = await this.workspaces.list(WORKSPACE_SCAN_LIMIT)
        const ownerId = await this.ownerOf(named, seed.ownerWorkspace)
        const doomed = await this.ownedLive(named, seed.workspaceName, ownerId)
        if (doomed.length === 0) {
            this.options.print(
                `${seed.identifier}: nothing to remove on ${environment}: no live workspace "${seed.workspaceName}"`,
            )
            return
        }
        for (const id of doomed) {
            this.options.print(
                `${seed.identifier}: remove on ${environment} the workspace "${seed.workspaceName}" ${id} with everything in it, ` +
                    "the foundation and all that was made while testing (conversations, runs, documents, records), through the owner's " +
                    "delete door: every seat disabled at once, its rows kept until an operator prune",
            )
        }
        if (!execute) {
            this.options.print("dry run: nothing removed; run again with --execute to remove")
            return
        }
        await eachInOrder(doomed, async (id) => {
            await this.lobby.remove(ownerId, id, seed.workspaceName)
            this.options.print(`${seed.identifier}: removed workspace ${id}`)
        })
    }

    /** The owner of the one live workspace of that name; none or several are refused. */
    private async ownerOf(named: ReadonlyArray<NamedWorkspace>, name: string): Promise<string> {
        const ids = await this.liveNamed(named, name)
        const [only] = ids
        if (only === undefined || ids.length > 1) return invalid("ownerWorkspace")
        return (await this.workspaces.ownerIdOf(only)) ?? invalid("ownerWorkspace")
    }

    /** The live workspaces of that name the owner owns. */
    private async ownedLive(
        named: ReadonlyArray<NamedWorkspace>,
        name: string,
        ownerId: string,
    ): Promise<Array<string>> {
        const owned: Array<string> = []
        await eachInOrder(await this.liveNamed(named, name), async (id) => {
            if ((await this.workspaces.ownerIdOf(id)) === ownerId) owned.push(id)
        })
        return owned
    }

    /** The ids of the workspaces of that name nobody deleted. */
    private async liveNamed(named: ReadonlyArray<NamedWorkspace>, name: string): Promise<Array<string>> {
        const live: Array<string> = []
        await eachInOrder(
            named.filter((workspace) => workspace.name === name),
            async (workspace) => {
                if (await this.workspaces.isLive(workspace.id)) live.push(workspace.id)
            },
        )
        return live
    }
}
