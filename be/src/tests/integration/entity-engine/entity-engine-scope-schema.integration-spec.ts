import assert from "node:assert/strict"
import {
    CAN_EXECUTE,
    ENGINE_MEMBERS,
    ENGINE_POLICIES,
    ENGINE_ROLE,
    ENGINE_TABLES,
    EXTENSION_SCHEMA,
    LINK_FOREIGN_KEYS,
    PUBLIC_EXECUTE,
    RECORDS_PARTITIONING,
    RLS_FLAGS,
    SCHEMA_USAGE,
    TABLE_PRIVILEGES,
} from "../../world/entity-engine-scope.sql"
import { catalogRows } from "../../world/entity-engine-scope-proof.service"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [] })

const ENTER = "public.engine_scope_enter(uuid)"
const WORKSPACE = "public.engine_workspace()"
const COMMANDS = ["delete", "insert", "select", "update"] as const
const byName = (left: string, right: string): number => left.localeCompare(right)
const OTHER_ROLES = ["anon", "authenticated", "service_role"] as const

interface Privileges {
    readonly can_select: boolean
    readonly can_insert: boolean
    readonly can_update: boolean
    readonly can_delete: boolean
    readonly can_truncate: boolean
    readonly can_reference: boolean
    readonly can_trigger: boolean
}

const privileges = async (role: string, table: string): Promise<Privileges> => {
    const [row] = await catalogRows<Privileges>(world, TABLE_PRIVILEGES, [role, `public.${table}`])
    assert(row, `No privilege row for ${role} on ${table}`)
    return row
}

const allowed = async (statement: typeof CAN_EXECUTE, ...params: Array<string>): Promise<boolean> => {
    const [row] = await catalogRows<{ allowed: boolean }>(world, statement, params)
    return row?.allowed === true
}

describe("the engine role", () => {
    it("is NOLOGIN, NOINHERIT, NOBYPASSRLS and not a superuser", async () => {
        const rows = await catalogRows<{ login: boolean; inherit: boolean; bypass: boolean; super: boolean }>(
            world,
            ENGINE_ROLE,
        )
        expect(rows).toEqual([{ login: false, inherit: false, bypass: false, super: false }])
    })

    it("is granted to app_be only, with the SET option and without inheritance", async () => {
        const rows = await catalogRows<{ member: string; set_option: boolean; inherit_option: boolean }>(
            world,
            ENGINE_MEMBERS,
        )
        expect(rows).toEqual([{ member: "app_be", set_option: true, inherit_option: false }])
    })

    it("has no usage of the auth schema and no grant on tables the engine does not serve", async () => {
        expect(await allowed(SCHEMA_USAGE, "app_engine", "auth")).toBe(false)
        expect(await privileges("app_engine", "workspaces")).toMatchObject({
            can_select: false,
            can_insert: false,
            can_update: false,
        })
    })
})

describe("the scope functions", () => {
    it("enter is executable by app_be only", async () => {
        expect(await allowed(CAN_EXECUTE, "app_be", ENTER)).toBe(true)
        await Promise.all(
            ["app_engine", ...OTHER_ROLES].map(async (role) => {
                expect(await allowed(CAN_EXECUTE, role, ENTER)).toBe(false)
            }),
        )
        expect(await allowed(PUBLIC_EXECUTE, ENTER)).toBe(false)
    })

    it("workspace is executable by app_engine only", async () => {
        expect(await allowed(CAN_EXECUTE, "app_engine", WORKSPACE)).toBe(true)
        await Promise.all(
            ["app_be", ...OTHER_ROLES].map(async (role) => {
                expect(await allowed(CAN_EXECUTE, role, WORKSPACE)).toBe(false)
            }),
        )
        expect(await allowed(PUBLIC_EXECUTE, WORKSPACE)).toBe(false)
    })
})

describe("the engine tables", () => {
    it.each(ENGINE_TABLES)(
        "%s: row-level security is on and the engine holds SELECT, INSERT, UPDATE, DELETE only",
        async (table) => {
            const flags = await catalogRows<{ name: string; enabled: boolean }>(world, RLS_FLAGS, [[table]])
            expect(flags).toEqual([{ name: table, enabled: true }])
            expect(await privileges("app_engine", table)).toEqual({
                can_select: true,
                can_insert: true,
                can_update: true,
                can_delete: true,
                can_truncate: false,
                can_reference: false,
                can_trigger: false,
            })
        },
    )

    it.each(ENGINE_TABLES)("%s: app_be and the browser roles hold no privilege (fail closed)", async (table) => {
        await Promise.all(
            ["app_be", ...OTHER_ROLES].map(async (role) => {
                expect(await privileges(role, table)).toMatchObject({
                    can_select: false,
                    can_insert: false,
                    can_update: false,
                    can_delete: false,
                })
            }),
        )
    })

    it("each table carries one named policy per command, scoped on the workspace of the transaction", async () => {
        const policies = await catalogRows<{
            tablename: string
            policyname: string
            roles: Array<string>
            using_text: string | null
            check_text: string | null
        }>(world, ENGINE_POLICIES)
        const expected = ENGINE_TABLES.flatMap((table) => COMMANDS.map((command) => `${table}_app_engine_${command}`))
        expect(policies.map((policy) => policy.policyname).toSorted(byName)).toEqual(expected.toSorted(byName))
        policies.forEach((policy) => {
            expect(policy.roles).toEqual(["app_engine"])
            const text = `${policy.using_text ?? ""}${policy.check_text ?? ""}`
            expect(text).toContain("engine_workspace()")
            expect(text).toContain("workspace_id")
        })
    })
})

describe("the records model", () => {
    it("records are partitioned by list with no default partition", async () => {
        const [row] = await catalogRows<{ strategy: string; defaults: number }>(world, RECORDS_PARTITIONING)
        expect(row).toEqual({ strategy: "l", defaults: 0 })
    })

    it("a link joins records of one workspace: both foreign keys name the workspace", async () => {
        const keys = await catalogRows<{ name: string; definition: string }>(world, LINK_FOREIGN_KEYS)
        const records = keys.filter(
            (key) => key.name === "record_links_from_fkey" || key.name === "record_links_to_fkey",
        )
        expect(records.map((key) => key.name)).toEqual(["record_links_from_fkey", "record_links_to_fkey"])
        records.forEach((key) => {
            expect(key.definition).toContain("workspace_id")
            expect(key.definition).toContain("ON DELETE RESTRICT")
        })
    })

    it.each(["pg_trgm", "btree_gist"])("%s is installed in the extensions schema", async (extension) => {
        const rows = await catalogRows<{ schema: string }>(world, EXTENSION_SCHEMA, [extension])
        expect(rows).toEqual([{ schema: "extensions" }])
    })
})
