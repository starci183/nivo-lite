import { Injectable, Module, type DynamicModule } from "@nestjs/common"
import { DataSource } from "typeorm"
import { installedModules } from "@tests/fixtures/builders/installed-modules.builder"
import { ENTITY_ENGINE_MESSAGES, EntityEngineModule, type EngineFailureAlerts } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WORKBENCH_DOOR_MESSAGES, WorkbenchDoorModule } from "@modules/domain/workbench-door"
import { MemberLookupService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import { EnvSource, Secret } from "@modules/platform/config"
import { PRIMARY_ENTITY_MANAGER, parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { PRIMARY_ENTITIES } from "@modules/platform/database/entities"
import { I18nModule } from "@modules/platform/i18n"
import { IdsModule } from "@modules/platform/ids"
import { JobsModule } from "@modules/platform/jobs"
import { QueueModule } from "@modules/platform/queue"
import type { WorldSandbox } from "./test-world.contracts"
import { queueOptions } from "./test-capabilities.options"
import { INSTALLED } from "@modules/domain/installed-plugins"

/** The seat the proof acts as: an owner of every workspace it opens a scene in. */
export const PROOF_MEMBER_ID = "00000000-0000-4000-8000-0000000000aa"

/** The user behind that seat. */
export const PROOF_USER_ID = "00000000-0000-4000-8000-0000000000ab"

/** The key that signs the cursors of the proof. */
const CURSOR_KEY = new Secret("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

/** The registry hash of the proof: the door does not compare it, a screen would. */
const REGISTRY_HASH = "proof"

/** The database role every statement of the proof runs as: the back end's own, which holds no table privilege on `records` but the scope function. */
const BACKEND_ROLE = "app_be"

/**
 * The world's database as the back end's role: the connection starts as that role (`SET ROLE` at startup), so a statement outside the
 * engine's scope finds no privilege, exactly as in production. The world connects as a superuser otherwise, which bypasses row security.
 */
export const backendSandbox: WorldSandbox = {
    create: () => {
        const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
        const url = new URL(config.url.reveal())
        url.searchParams.set("options", `-c role=${BACKEND_ROLE}`)
        return Promise.resolve(url.toString())
    },
    drop: () => Promise.resolve(),
}

/**
 * A connection of the database owner, for the scene a proof needs before the back end can act (users and workspaces): the world itself
 * runs as the back end's role. The caller destroys it.
 */
export const openOwnerConnection = async (): Promise<DataSource> => {
    const config = parsePrimaryDatabaseConfig(EnvSource.fromProcess())
    const source = new DataSource({
        type: "postgres",
        url: config.url.reveal(),
        entities: [...PRIMARY_ENTITIES],
        uuidExtension: "pgcrypto",
        synchronize: false,
        connectTimeoutMS: 5000,
    })
    return await source.initialize()
}

@Injectable()
/** The seats of the proof: one owner, whatever the user. */
export class ProofMembers {
    require(): Promise<{ readonly role: "owner" }> {
        return Promise.resolve({ role: "owner" })
    }

    idOf(): Promise<string> {
        return Promise.resolve(PROOF_MEMBER_ID)
    }
}

@Injectable()
/** The seat lookup of the proof: the owner is the only seat. */
export class ProofSeats {
    activeSeatById(
        _workspaceId: string,
        memberId: string,
    ): Promise<{ displayName: string; isManager: boolean } | null> {
        return Promise.resolve(memberId === PROOF_MEMBER_ID ? { displayName: "Lan", isManager: true } : null)
    }
}

@Injectable()
/** The installations of the proof: none are read, the modules under test have no installation port. */
export class ProofInstallations {
    list(): Promise<ReadonlyArray<never>> {
        return Promise.resolve([])
    }
}

@Injectable()
/** The alerts of the proof: nobody is told, the specs read what parked. */
export class ProofAlerts implements EngineFailureAlerts {
    raise(): Promise<void> {
        return Promise.resolve()
    }
}

@Module({
    providers: [
        { provide: WorkspaceMembersService, useClass: ProofMembers },
        { provide: MemberLookupService, useClass: ProofSeats },
        { provide: InstallationRecordsService, useClass: ProofInstallations },
    ],
    exports: [
        WorkspaceMembersService,
        MemberLookupService,
        InstallationRecordsService,
    ],
})
class ProofSeatsModule {}

/** The modules a suite composes to run the workbench door of the package on the engine, as the back end's role. */
export const workbenchDoorProofModules = (): Array<DynamicModule> => [
    QueueModule.register({ ...queueOptions, isGlobal: true }),
    IdsModule.register({ isGlobal: true }),
    JobsModule.register({
        isGlobal: true,
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "door-proof",
        leaseMs: 1000,
        scheduler: { enabled: false },
    }),
    I18nModule.register({ isGlobal: true, bundles: [WORKBENCH_DOOR_MESSAGES, ENTITY_ENGINE_MESSAGES] }),
    { module: ProofSeatsModule, global: true },
    EntityEngineModule.register({
        isGlobal: true,
        entities: INSTALLED.entities(),
        jobs: INSTALLED.jobs(),
        alerts: ProofAlerts,
        cursorKey: CURSOR_KEY,
    }),
    WorkbenchDoorModule.register({
        isGlobal: true,
        modules: installedModules(),
        entities: INSTALLED.entities(),
        registryHash: REGISTRY_HASH,
    }),
]
