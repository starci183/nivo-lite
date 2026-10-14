import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionActor } from "@modules/domain/connections"
import { DATABASE } from "@modules/integrations/data-sources"
import type { DatabaseClient, DatabasePreview, DatabaseTable, DatabaseTarget } from "@modules/integrations/data-sources"
import type { DatabaseSaveDraft, TableMapping } from "./database-config.contracts"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DatabaseWizardService } from "./database-wizard.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { DATABASE_WIZARD_COPY as COPY } from "./messages/database.messages"

describe("DatabaseWizardService", () => {
    const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
    const target: DatabaseTarget = {
        engine: "postgres",
        host: "db.example",
        port: 5432,
        database: "app",
        user: "owner",
        password: "typed-password",
        ssl: true,
    }
    const mapping: TableMapping = {
        schema: "public",
        table: "orders",
        entity: "order",
        idColumn: "id",
        titleColumn: "name",
        updatedColumn: "updated_at",
        columns: ["name"],
    }
    const tables: ReadonlyArray<DatabaseTable> = [
        { schema: "public", name: "orders", columns: [{ name: "id", type: "uuid" }] },
    ]
    const preview: DatabasePreview = { columns: ["id", "name"], rows: [["order-1", "First order"]] }
    const config =
        '{"tables":[{"schema":"public","table":"orders","entity":"order","idColumn":"id","titleColumn":"name","updatedColumn":"updated_at","columns":["name"]}]}'
    const typedCredential =
        '{"engine":"postgres","host":"db.example","port":5432,"database":"app","user":"owner","password":"typed-password","ssl":true}'
    const storedCredential =
        '{"engine":"postgres","host":"db.example","port":5432,"database":"app","user":"owner","password":"stored-password","ssl":true}'
    const meta = { config, summary: COPY.summary("PostgreSQL", 1), host: "db.example" }
    const draft: DatabaseSaveDraft = { name: " Orders ", target, tables: [mapping], everyMinutes: 60 }
    const connection: DataConnection = {
        id: "database-1",
        workspaceId: "workspace-1",
        provider: "database",
        name: "Saved orders",
        status: "connected",
        lastError: null,
        meta: { config, "cursor:public.orders": "old-cursor" },
        everyMinutes: 15,
        lastSyncAt: null,
    }
    const build = async () => {
        const hub = mock<DataHubService>()
        const database = mock<DatabaseClient>()
        hub.own.mockResolvedValue(connection)
        hub.credentialOf.mockResolvedValue(storedCredential)
        hub.agentIds.mockResolvedValue(["agent-1", "agent-2"])
        hub.create.mockResolvedValue("database-new")
        database.listTables.mockResolvedValue(tables)
        database.preview.mockResolvedValue(preview)
        const moduleRef = await Test.createTestingModule({
            providers: [
                DatabaseWizardService,
                { provide: DataHubService, useValue: hub },
                { provide: DATABASE, useValue: database },
            ],
        }).compile()
        return { service: moduleRef.get(DatabaseWizardService), hub, database }
    }

    it("tests the cleaned target and returns the visible tables", async () => {
        const { service, hub, database } = await build()

        await expect(
            service.test(actor, { target: { ...target, host: " db.example ", database: " app ", user: " owner " } }),
        ).resolves.toEqual(tables)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(database.listTables).toHaveBeenCalledWith(target)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
    })

    it("refuses a connected database with no visible tables", async () => {
        const { service, database } = await build()
        database.listTables.mockResolvedValue([])

        await expect(service.test(actor, { target })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.noTables },
        })
        expect(database.listTables).toHaveBeenCalledWith(target)
    })

    it("previews a cleaned mapping and returns the client rows", async () => {
        const { service, hub, database } = await build()

        await expect(
            service.preview(actor, { target, mapping: { ...mapping, columns: ["name", "name", "", 7] } }),
        ).resolves.toEqual(preview)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(database.preview).toHaveBeenCalledWith(target, mapping)
    })

    it("refuses a preview mapping without its id column before querying", async () => {
        const { service, database } = await build()

        await expect(service.preview(actor, { target, mapping: { table: "orders" } })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.needIdColumn("orders") },
        })
        expect(database.preview).not.toHaveBeenCalled()
    })

    it("creates a connection with cleaned public config and the separate credential", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, draft)).resolves.toBe("database-new")
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "database",
            name: "Orders",
            meta,
            credential: typedCredential,
            everyMinutes: 60,
        })
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
    })

    it("clips the trimmed name and defaults an omitted schedule to manual", async () => {
        const { service, hub } = await build()

        await expect(
            service.save(actor, { ...draft, connectionId: null, name: ` ${"N".repeat(81)} `, everyMinutes: undefined }),
        ).resolves.toBe("database-new")
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "database",
            name: "N".repeat(80),
            meta,
            credential: typedCredential,
            everyMinutes: null,
        })
    })

    it("updates an owned connection and drops its old cursors", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, connectionId: "database-1" })).resolves.toBe("database-1")
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "database-1", "database")
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(hub.saveCredential).toHaveBeenCalledWith("database-1", typedCredential)
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "database-1", { name: "Orders", meta, everyMinutes: 60 })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("reuses an owned password while permitting a changed port, database and TLS", async () => {
        const { service, hub } = await build()
        const changedTarget = { ...target, password: "", port: 15432, database: "other", ssl: false }

        await expect(
            service.save(actor, { ...draft, connectionId: "database-1", target: changedTarget, everyMinutes: null }),
        ).resolves.toBe("database-1")
        expect(hub.own).toHaveBeenCalledTimes(2)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "database-1", "database")
        expect(hub.credentialOf).toHaveBeenCalledWith("database-1")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "database-1",
            '{"engine":"postgres","host":"db.example","port":15432,"database":"other","user":"owner","password":"stored-password","ssl":false}',
        )
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "database-1", {
            name: "Orders",
            meta,
            everyMinutes: null,
        })
    })

    it("tests an owned connection with its stored password", async () => {
        const { service, hub, database } = await build()

        await expect(
            service.test(actor, { connectionId: "database-1", target: { ...target, password: "" } }),
        ).resolves.toEqual(tables)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "database-1", "database")
        expect(hub.credentialOf).toHaveBeenCalledWith("database-1")
        expect(database.listTables).toHaveBeenCalledWith({ ...target, password: "stored-password" })
    })

    it.each([
        { label: "missing credential", credential: null },
        { label: "changed engine", credential: JSON.stringify({ ...target, engine: "mysql" }) },
        { label: "changed host", credential: JSON.stringify({ ...target, host: "other.example" }) },
        { label: "changed user", credential: JSON.stringify({ ...target, user: "other" }) },
    ])("requires a typed password for $label", async ({ credential }) => {
        const { service, hub, database } = await build()
        hub.credentialOf.mockResolvedValue(credential)

        await expect(
            service.test(actor, { connectionId: "database-1", target: { ...target, password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.needPassword } })
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "database-1", "database")
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it("refuses an invalid typed target before reading a credential or contacting the server", async () => {
        const { service, hub, database } = await build()

        await expect(
            service.test(actor, { connectionId: "database-1", target: { ...target, host: " ", password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.needHost } })
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it.each([
        { name: " ", everyMinutes: 60, detail: COPY.needName },
        { name: "Orders", everyMinutes: 30, detail: COPY.badSchedule },
    ])("refuses a bad save name or schedule: $detail", async ({ name, everyMinutes, detail }) => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, name, everyMinutes })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.create).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
    })

    it("requires a password when saving a new connection", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, target: { ...target, password: "" } })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.needPassword },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("loads the saved target without its password, along with mappings and grants", async () => {
        const { service, hub } = await build()

        await expect(service.load(actor, "database-1")).resolves.toEqual({
            name: "Saved orders",
            target: { engine: "postgres", host: "db.example", port: 5432, database: "app", user: "owner", ssl: true },
            hasPassword: true,
            tables: [mapping],
            everyMinutes: 15,
            agentIds: ["agent-1", "agent-2"],
        })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "database-1", "database")
        expect(hub.credentialOf).toHaveBeenCalledWith("database-1")
        expect(hub.agentIds).toHaveBeenCalledWith("workspace-1", "database-1")
    })

    it("refuses to load a connection without a credential", async () => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(null)

        await expect(service.load(actor, "database-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.brokenSaved },
        })
        expect(hub.agentIds).not.toHaveBeenCalled()
    })

    it("preserves a malformed saved credential refusal", async () => {
        const { service, hub, database } = await build()
        hub.credentialOf.mockResolvedValue("{")

        await expect(
            service.test(actor, { connectionId: "database-1", target: { ...target, password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.brokenCredential } })
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it("requires the owner before every wizard operation", async () => {
        const { service, hub, database } = await build()
        const refusal = new DataHubError({ code: DataHubErrorCode.NotFound })
        hub.owner.mockRejectedValue(refusal)

        await expect(service.test(actor, { target })).rejects.toBe(refusal)
        await expect(service.preview(actor, { target, mapping })).rejects.toBe(refusal)
        await expect(service.save(actor, draft)).rejects.toBe(refusal)
        await expect(service.load(actor, "database-1")).rejects.toBe(refusal)
        expect(hub.owner).toHaveBeenCalledTimes(4)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(database.listTables).not.toHaveBeenCalled()
        expect(database.preview).not.toHaveBeenCalled()
    })
})
