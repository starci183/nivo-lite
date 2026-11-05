import { parseCatalogSnapshot } from "./catalog-snapshot.policy"

const policy = {
    name: "records_app_engine_select",
    roles: ["app_engine"],
    command: "select",
    permissive: true,
    qual: "(workspace_id = engine_workspace())",
    check: null,
}

const base = {
    name: "records",
    rlsEnabled: true,
    rlsForced: true,
    policies: [policy],
    grants: [{ role: "app_engine", privileges: ["select"] }],
}

const valid = {
    extensions: ["pg_trgm"],
    bases: [base],
    partitions: [
        {
            name: "records_sales_lead",
            bound: "sales.lead",
            constraints: [
                {
                    name: "records_sales_lead_pkey",
                    kind: "primary",
                    definition: "PRIMARY KEY (entity, id)",
                    validated: true,
                },
            ],
            indexes: [
                {
                    name: "records_sales_lead_pkey",
                    columns: ["entity", "id"],
                    unique: true,
                    method: "btree",
                    predicate: null,
                },
            ],
        },
    ],
    views: [{ name: "v_records_sales_lead", columns: [{ name: "id", type: "uuid" }] }],
}

describe("parseCatalogSnapshot", () => {
    it("accepts what engine_catalog returns", () => {
        expect(parseCatalogSnapshot(valid)).toEqual({ ok: true, snapshot: valid })
    })

    it("refuses an unknown key", () => {
        const parsed = parseCatalogSnapshot({ ...valid, extra: 1 })
        expect(parsed.ok).toBe(false)
        expect(parsed.ok ? [] : parsed.issues).toHaveLength(1)
    })

    it("refuses a wrong shape and names where", () => {
        const parsed = parseCatalogSnapshot({ ...valid, bases: [{ ...base, rlsEnabled: "yes" }] })
        expect(parsed.ok ? [] : parsed.issues).toEqual([expect.stringContaining("bases.0.rlsEnabled")])
    })

    it("refuses a list over its bound and a non-object", () => {
        expect(parseCatalogSnapshot({ ...valid, extensions: Array.from({ length: 201 }, () => "x") }).ok).toBe(false)
        expect(parseCatalogSnapshot("nope").ok).toBe(false)
    })
})
