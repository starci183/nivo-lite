import { Injectable } from "@nestjs/common"
import type { ConnectionActor } from "@modules/domain/connections"
import { InjectDatabase } from "@modules/integrations/data-sources"
import type { DatabaseClient, DatabasePreview, DatabaseTable, DatabaseTarget } from "@modules/integrations/data-sources"
import { DATABASE_SCHEDULES } from "./database-config.contracts"
import type {
    DatabasePreviewDraft,
    DatabaseSaveDraft,
    DatabaseTestDraft,
    SavedDatabase,
} from "./database-config.contracts"
import {
    checkTarget,
    cleanTables,
    cleanTarget,
    credentialOf,
    invalid,
    parseTarget,
    savedTables,
    summaryOf,
} from "./database-config.policy"
import { DataHubService } from "./data-hub.service"
import { DATABASE_WIZARD_COPY as COPY } from "./messages/database.messages"

const NAME_MAX = 80

@Injectable()
/** The wizard operations of the owner databases: test, preview, save and reopen. Owner only; the password never leaves the back end. */
export class DatabaseWizardService {
    constructor(
        private readonly hub: DataHubService,
        @InjectDatabase() private readonly database: DatabaseClient,
    ) {}

    /** Connects read only and lists the tables the user can see. */
    async test(actor: ConnectionActor, draft: DatabaseTestDraft): Promise<ReadonlyArray<DatabaseTable>> {
        await this.hub.owner(actor)
        const target = await this.resolveTarget(actor.workspaceId, draft)
        const tables = await this.database.listTables(target)
        if (tables.length === 0) throw invalid(COPY.noTables)
        return tables
    }

    /** The first 5 rows of one mapped table. */
    async preview(actor: ConnectionActor, draft: DatabasePreviewDraft): Promise<DatabasePreview> {
        await this.hub.owner(actor)
        const target = await this.resolveTarget(actor.workspaceId, draft)
        const [mapping] = cleanTables([draft.mapping]).tables
        if (mapping === undefined) throw invalid(COPY.needTable)
        return this.database.preview(target, mapping)
    }

    /** Creates the connection, or (with a connection id) updates it; answers its id. */
    async save(actor: ConnectionActor, draft: DatabaseSaveDraft): Promise<string> {
        await this.hub.owner(actor)
        const name = draft.name.trim().slice(0, NAME_MAX)
        if (name === "") throw invalid(COPY.needName)
        const everyMinutes = draft.everyMinutes ?? null
        if (!DATABASE_SCHEDULES.includes(everyMinutes)) throw invalid(COPY.badSchedule)
        const target = await this.resolveTarget(actor.workspaceId, draft)
        if (target.password === "") throw invalid(COPY.needPassword)
        const config = cleanTables(draft.tables)
        // Cursors are dropped on every save: the mapping may have changed, so the next sync reads from the start again.
        const meta = {
            config: JSON.stringify(config),
            summary: summaryOf(target.engine, config.tables.length),
            host: target.host,
        }
        const credential = credentialOf(target)
        const connectionId = draft.connectionId ?? null
        if (connectionId === null) {
            return this.hub.create(actor, { provider: "database", name, meta, credential, everyMinutes })
        }
        await this.hub.own(actor.workspaceId, connectionId, "database")
        await this.hub.saveCredential(connectionId, credential)
        await this.hub.update(actor.workspaceId, connectionId, { name, meta, everyMinutes })
        return connectionId
    }

    /** Reopens a saved connection for editing; the password is not returned, only whether one is stored. */
    async load(actor: ConnectionActor, connectionId: string): Promise<SavedDatabase> {
        await this.hub.owner(actor)
        const connection = await this.hub.own(actor.workspaceId, connectionId, "database")
        const stored = await this.storedTarget(connectionId)
        if (stored === null) throw invalid(COPY.brokenSaved)
        const { engine, host, port, database, user, ssl } = stored
        return {
            name: connection.name,
            target: { engine, host, port, database, user, ssl },
            hasPassword: true,
            tables: savedTables(connection.meta.config),
            everyMinutes: connection.everyMinutes,
            agentIds: await this.hub.agentIds(actor.workspaceId, connectionId),
        }
    }

    private async storedTarget(connectionId: string): Promise<DatabaseTarget | null> {
        const raw = await this.hub.credentialOf(connectionId)
        return raw === null ? null : parseTarget(raw)
    }

    /** The target to connect with: the typed password, or (blank) the stored one when it is the same server, engine and user. */
    private async resolveTarget(workspaceId: string, draft: DatabaseTestDraft): Promise<DatabaseTarget> {
        const typed = cleanTarget(draft.target)
        const bad = checkTarget(typed)
        if (bad !== null) throw invalid(bad)
        const connectionId = draft.connectionId ?? null
        if (typed.password !== "" || connectionId === null) return typed
        await this.hub.own(workspaceId, connectionId, "database")
        const stored = await this.storedTarget(connectionId)
        if (
            stored === null ||
            stored.engine !== typed.engine ||
            stored.host !== typed.host ||
            stored.user !== typed.user
        ) {
            throw invalid(COPY.needPassword)
        }
        return { ...typed, password: stored.password }
    }
}
