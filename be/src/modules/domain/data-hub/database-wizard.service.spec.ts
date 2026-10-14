import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionActor } from "@modules/domain/connections"
import { DATABASE } from "@modules/integrations/data-sources"
import type { DatabaseClient, DatabasePreview, DatabaseTable, DatabaseTarget } from "@modules/integrations/data-sources"
import type { DatabaseSaveDraft, DatabaseTargetView, TableMapping } from "./database-config.contracts"
import * as databaseConfigPolicy from "./database-config.policy"
import { DatabaseWizardService } from "./database-wizard.service"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { DATABASE_WIZARD_COPY as COPY } from "./messages/database.messages"

describe("DatabaseWizardService", () => {
    const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
    const targetView: DatabaseTargetView = {
        engine: "postgres",
        host: "database.example.com",
        port: 5432,
        database: "sales",
        user: "reader",
        ssl: true,
    }
    const target: DatabaseTarget = { ...targetView, password: "typed-password" }
    const mapping: TableMapping = {
        schema: "public",
        table: "customers",
        entity: "customer",
        idColumn: "id",
        titleColumn: "name",
        updatedColumn: "updated_at",
        columns: ["id", "name"],
    }
    const tables: ReadonlyArray<DatabaseTable> = [
        {
            schema: "public",
            name: "customers",
            columns: [
                { name: "id", type: "text" },
                { name: "name", type: "text" },
            ],
        },
    ]
    const preview: DatabasePreview = { columns: ["id", "name"], rows: [["customer-1", "Alice"]] }
    const connection: DataConnection = {
        id: "connection-1",
        workspaceId: "workspace-1",
        provider: "database",
        name: "Sales",
        status: "connected",
        lastError: null,
        meta: { config: JSON.stringify({ tables: [mapping] }), "cursor:public.customers": "old-cursor" },
        everyMinutes: 60,
        lastSyncAt: null,
    }
    const draft: DatabaseSaveDraft = { name: "  Sales  ", target, tables: [mapping] }
    const credential =
        '{"engine":"postgres","host":"database.example.com","port":5432,"database":"sales","user":"reader","password":"typed-password","ssl":true}'
    const meta = {
        config: JSON.stringify({ tables: [mapping] }),
        summary: COPY.summary("PostgreSQL", 1),
        host: "database.example.com",
    }

    const build = async () => {
        const hub = mock<DataHubService>()
        const database = mock<DatabaseClient>()
        hub.own.mockResolvedValue(connection)
        hub.credentialOf.mockResolvedValue(JSON.stringify({ ...target, password: "stored-password" }))
        hub.create.mockResolvedValue("connection-new")
        hub.agentIds.mockResolvedValue(["agent-1", "agent-2"])
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

    it("lists the visible tables using the cleaned typed target after checking the owner", async () => {
        const { service, hub, database } = await build()

        await expect(
            service.test(actor, {
                target: { ...target, host: "  database.example.com  ", database: "  sales  ", user: "  reader  " },
            }),
        ).resolves.toEqual(tables)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(database.listTables).toHaveBeenCalledWith(target)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
    })

    it("refuses a successful connection that exposes no tables", async () => {
        const { service, database } = await build()
        database.listTables.mockResolvedValue([])

        await expect(service.test(actor, { target })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.noTables },
        })
        expect(database.listTables).toHaveBeenCalledWith(target)
    })

    it.each([
        { reason: "a new passwordless connection", connectionId: null, password: "" },
        { reason: "a typed replacement password", connectionId: "connection-1", password: "typed-password" },
    ])("tests $reason without reading a saved credential", async ({ connectionId, password }) => {
        const { service, database, hub } = await build()
        const typed = { ...target, password }

        await expect(service.test(actor, { connectionId, target: typed })).resolves.toEqual(tables)
        expect(database.listTables).toHaveBeenCalledWith(typed)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
    })

    it("reuses a stored password for the same engine, host and user while retaining other typed settings", async () => {
        const { service, database, hub } = await build()
        const editedTarget = { ...target, port: 5433, database: "archive", ssl: false }

        await expect(
            service.test(actor, {
                connectionId: "connection-1",
                target: { ...editedTarget, host: "  database.example.com  ", password: "" },
            }),
        ).resolves.toEqual(tables)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "database")
        expect(hub.credentialOf).toHaveBeenCalledWith("connection-1")
        expect(database.listTables).toHaveBeenCalledWith({ ...editedTarget, password: "stored-password" })
    })

    it.each([
        { reason: "missing credential", stored: null },
        { reason: "different engine", stored: JSON.stringify({ ...target, engine: "mysql" }) },
        { reason: "different host", stored: JSON.stringify({ ...target, host: "other.example.com" }) },
        { reason: "different user", stored: JSON.stringify({ ...target, user: "other-reader" }) },
    ])("requires a typed password when the saved target has a $reason", async ({ stored }) => {
        const { service, database, hub } = await build()
        hub.credentialOf.mockResolvedValue(stored)

        await expect(
            service.test(actor, { connectionId: "connection-1", target: { ...target, password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.needPassword } })
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "database")
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it.each([
        { reason: "blank host", target: { ...target, host: " " }, detail: COPY.needHost },
        { reason: "oversized host", target: { ...target, host: "h".repeat(254) }, detail: COPY.needHost },
        { reason: "fractional port", target: { ...target, port: 5432.5 }, detail: COPY.badPort },
        { reason: "port below range", target: { ...target, port: 0 }, detail: COPY.badPort },
        { reason: "port above range", target: { ...target, port: 65_536 }, detail: COPY.badPort },
        { reason: "blank database", target: { ...target, database: " " }, detail: COPY.needDatabase },
        { reason: "oversized database", target: { ...target, database: "d".repeat(129) }, detail: COPY.needDatabase },
        { reason: "blank user", target: { ...target, user: " " }, detail: COPY.needUser },
        { reason: "oversized user", target: { ...target, user: "u".repeat(129) }, detail: COPY.needUser },
        {
            reason: "oversized password",
            target: { ...target, password: "p".repeat(513) },
            detail: COPY.passwordTooLong,
        },
    ])("refuses a target with a $reason before reaching the database", async ({ target: invalidTarget, detail }) => {
        const { service, database, hub } = await build()

        await expect(service.test(actor, { target: invalidTarget })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(database.listTables).not.toHaveBeenCalled()
        expect(hub.own).not.toHaveBeenCalled()
    })

    it("preserves an unsupported engine refusal from target validation", async () => {
        const { service, database, hub } = await build()
        const validator = jest.spyOn(databaseConfigPolicy, "checkTarget").mockReturnValueOnce(COPY.badEngine)

        try {
            await expect(service.test(actor, { target })).rejects.toMatchObject({
                code: DataHubErrorCode.Invalid,
                params: { detail: COPY.badEngine },
            })
            expect(validator).toHaveBeenCalledWith(target)
            expect(database.listTables).not.toHaveBeenCalled()
            expect(hub.own).not.toHaveBeenCalled()
        } finally {
            validator.mockRestore()
        }
    })

    it("preserves a database failure while listing tables", async () => {
        const { service, database } = await build()
        const cause = new Error("table list failed")
        database.listTables.mockRejectedValue(cause)

        await expect(service.test(actor, { target })).rejects.toBe(cause)
    })

    it("previews the selected table with a cleaned mapping", async () => {
        const { service, database, hub } = await build()

        await expect(
            service.preview(actor, {
                target,
                mapping: { ...mapping, columns: ["id", "name", "id", "invalid\u0000column"], ignored: "discarded" },
            }),
        ).resolves.toEqual(preview)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(database.preview).toHaveBeenCalledWith(target, mapping)
    })

    it("refuses a preview mapping without an id column", async () => {
        const { service, database } = await build()

        await expect(service.preview(actor, { target, mapping: { ...mapping, idColumn: "" } })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: COPY.needIdColumn("customers") },
        })
        expect(database.preview).not.toHaveBeenCalled()
    })

    it("preserves a database failure while previewing rows", async () => {
        const { service, database } = await build()
        const cause = new Error("preview failed")
        database.preview.mockRejectedValue(cause)

        await expect(service.preview(actor, { target, mapping })).rejects.toBe(cause)
    })

    it.each<[string, Partial<DatabaseSaveDraft>, string, number | null]>([
        ["manual schedule", {}, "Sales", null],
        ["capped name", { name: `  ${"N".repeat(85)}  ` }, "N".repeat(80), null],
        ["explicit manual schedule", { connectionId: null, everyMinutes: null }, "Sales", null],
        ["15 minute schedule", { connectionId: null, everyMinutes: 15 }, "Sales", 15],
        ["60 minute schedule", { connectionId: null, everyMinutes: 60 }, "Sales", 60],
        ["360 minute schedule", { connectionId: null, everyMinutes: 360 }, "Sales", 360],
        ["1440 minute schedule", { connectionId: null, everyMinutes: 1440 }, "Sales", 1440],
    ])(
        "creates a connection with %s and separate cleaned credentials",
        async (_reason, overrides, name, everyMinutes) => {
            const { service, hub } = await build()

            await expect(
                service.save(actor, {
                    ...draft,
                    ...overrides,
                    target: { ...target, host: " database.example.com ", database: " sales ", user: " reader " },
                    tables: [{ ...mapping, columns: ["id", "name", "id"], cursor: "discarded" }],
                }),
            ).resolves.toBe("connection-new")
            expect(hub.owner).toHaveBeenCalledWith(actor)
            expect(hub.create).toHaveBeenCalledWith(actor, {
                provider: "database",
                name,
                meta,
                credential,
                everyMinutes,
            })
            expect(hub.own).not.toHaveBeenCalled()
            expect(hub.saveCredential).not.toHaveBeenCalled()
            expect(hub.update).not.toHaveBeenCalled()
        },
    )

    it("updates an owned connection with a typed password and replaces its cursor metadata", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, connectionId: "connection-1", everyMinutes: 15 })).resolves.toBe(
            "connection-1",
        )
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "database")
        expect(hub.saveCredential).toHaveBeenCalledWith("connection-1", credential)
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "connection-1", {
            name: "Sales",
            meta,
            everyMinutes: 15,
        })
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("keeps the stored password when saving an existing connection with a blank password", async () => {
        const { service, hub } = await build()

        await expect(
            service.save(actor, { ...draft, connectionId: "connection-1", target: { ...target, password: "" } }),
        ).resolves.toBe("connection-1")
        expect(hub.own).toHaveBeenCalledTimes(2)
        expect(hub.own).toHaveBeenNthCalledWith(1, "workspace-1", "connection-1", "database")
        expect(hub.own).toHaveBeenNthCalledWith(2, "workspace-1", "connection-1", "database")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "connection-1",
            '{"engine":"postgres","host":"database.example.com","port":5432,"database":"sales","user":"reader","password":"stored-password","ssl":true}',
        )
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "connection-1", {
            name: "Sales",
            meta,
            everyMinutes: null,
        })
    })

    it("requires a password when the reusable saved credential has an empty password", async () => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(JSON.stringify({ ...target, password: "" }))

        await expect(
            service.save(actor, { ...draft, connectionId: "connection-1", target: { ...target, password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.needPassword } })
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
    })

    it.each<[string, Partial<DatabaseSaveDraft>, string]>([
        ["blank name", { name: "  " }, COPY.needName],
        ["unsupported schedule", { everyMinutes: 30 }, COPY.badSchedule],
        ["missing password", { target: { ...target, password: "" } }, COPY.needPassword],
        ["missing table list", { tables: undefined }, COPY.needTable],
        ["empty table list", { tables: [] }, COPY.needTable],
        ["too many tables", { tables: Array.from({ length: 101 }, () => mapping) }, COPY.tooManyTables],
        ["unnamed table", { tables: [{ ...mapping, table: "" }] }, COPY.needIdColumn(COPY.unnamedTable)],
        ["missing id column", { tables: [{ ...mapping, idColumn: "" }] }, COPY.needIdColumn("customers")],
        ["duplicate table", { tables: [mapping, mapping] }, COPY.pickedTwice("public.customers")],
    ])("refuses a %s before persisting a connection", async (_reason, overrides, detail) => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, ...overrides })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
    })

    it.each<["create" | "own" | "saveCredential" | "update", string | null, Array<Array<string>>, number]>([
        ["create", null, [], 0],
        ["own", "connection-1", [], 0],
        ["saveCredential", "connection-1", [["connection-1", credential]], 0],
        ["update", "connection-1", [["connection-1", credential]], 1],
    ])(
        "preserves a %s failure and stops later persistence steps",
        async (method, connectionId, credentials, updates) => {
            const { service, hub } = await build()
            const cause = new Error(`${method} failed`)
            hub[method].mockRejectedValue(cause)

            await expect(service.save(actor, { ...draft, connectionId })).rejects.toBe(cause)
            expect(hub.saveCredential.mock.calls).toEqual(credentials)
            expect(hub.update).toHaveBeenCalledTimes(updates)
        },
    )

    it.each<[string, Readonly<Record<string, string>>, ReadonlyArray<TableMapping>, number | null, Array<string>]>([
        ["valid", connection.meta, [mapping], 60, ["agent-1", "agent-2"]],
        ["missing", {}, [], null, []],
        ["malformed", { config: "{" }, [], null, []],
        ["invalid", { config: '{"tables":[]}' }, [], null, []],
    ])(
        "loads %s configuration with its grants and schedule without exposing the password",
        async (_reason, savedMeta, savedMappings, everyMinutes, agentIds) => {
            const { service, hub } = await build()
            hub.own.mockResolvedValue({ ...connection, meta: savedMeta, everyMinutes })
            hub.agentIds.mockResolvedValue(agentIds)

            await expect(service.load(actor, "connection-1")).resolves.toEqual({
                name: "Sales",
                target: targetView,
                hasPassword: true,
                tables: savedMappings,
                everyMinutes,
                agentIds,
            })
            expect(hub.owner).toHaveBeenCalledWith(actor)
            expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "database")
            expect(hub.credentialOf).toHaveBeenCalledWith("connection-1")
            expect(hub.agentIds).toHaveBeenCalledWith("workspace-1", "connection-1")
        },
    )

    it.each([
        { reason: "missing", stored: null, detail: COPY.brokenSaved },
        { reason: "malformed", stored: "{", detail: COPY.brokenCredential },
        { reason: "non-object", stored: "null", detail: COPY.brokenCredential },
        { reason: "incomplete", stored: "{}", detail: COPY.incompleteCredential },
    ])("refuses a $reason saved credential while reopening a connection", async ({ stored, detail }) => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(stored)

        await expect(service.load(actor, "connection-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.agentIds).not.toHaveBeenCalled()
    })

    it("preserves a broken saved credential refusal while resolving a blank typed password", async () => {
        const { service, database, hub } = await build()
        hub.credentialOf.mockResolvedValue("{")

        await expect(
            service.test(actor, { connectionId: "connection-1", target: { ...target, password: "" } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: COPY.brokenCredential } })
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it("checks connection ownership before reading a saved password for reuse", async () => {
        const { service, database, hub } = await build()
        const cause = new Error("connection not owned")
        hub.own.mockRejectedValue(cause)

        await expect(
            service.test(actor, { connectionId: "connection-1", target: { ...target, password: "" } }),
        ).rejects.toBe(cause)
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(database.listTables).not.toHaveBeenCalled()
    })

    it.each<["own" | "credentialOf" | "agentIds", Array<Array<string>>, number]>([
        ["own", [], 0],
        ["credentialOf", [["connection-1"]], 0],
        ["agentIds", [["connection-1"]], 1],
    ])("preserves a %s failure and stops later reopening steps", async (method, credentials, grants) => {
        const { service, hub } = await build()
        const cause = new Error(`${method} failed`)
        hub[method].mockRejectedValue(cause)

        await expect(service.load(actor, "connection-1")).rejects.toBe(cause)
        expect(hub.credentialOf.mock.calls).toEqual(credentials)
        expect(hub.agentIds).toHaveBeenCalledTimes(grants)
    })

    it.each([
        { operation: "testing", call: (service: DatabaseWizardService) => service.test(actor, { target }) },
        {
            operation: "previewing",
            call: (service: DatabaseWizardService) => service.preview(actor, { target, mapping }),
        },
        { operation: "saving", call: (service: DatabaseWizardService) => service.save(actor, draft) },
        { operation: "reopening", call: (service: DatabaseWizardService) => service.load(actor, "connection-1") },
    ])("stops before $operation a connection when the owner check fails", async ({ call }) => {
        const { service, database, hub } = await build()
        const cause = new Error("owner required")
        hub.owner.mockRejectedValue(cause)

        await expect(call(service)).rejects.toBe(cause)
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(hub.own).not.toHaveBeenCalled()
        expect(hub.credentialOf).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
        expect(hub.saveCredential).not.toHaveBeenCalled()
        expect(hub.update).not.toHaveBeenCalled()
        expect(hub.agentIds).not.toHaveBeenCalled()
        expect(database.listTables).not.toHaveBeenCalled()
        expect(database.preview).not.toHaveBeenCalled()
    })
})
