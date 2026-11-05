import type {
    CatalogBase,
    CatalogConstraint,
    CatalogPartition,
    CatalogPolicyCommand,
    CatalogSnapshot,
    CatalogView,
    PlanOp,
} from "./catalog.types"
import type { EntityDefinition } from "./entity.types"
import { planOf } from "./plan"

const COMMANDS: ReadonlyArray<CatalogPolicyCommand> = ["select", "insert", "update", "delete"]
const QUAL = "(workspace_id = engine_workspace())"

const plain: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: {
        name: { kind: "text", nullable: false, maxLength: 200, searchable: true },
        stage: { kind: "enum", nullable: false, of: ["new", "won"] },
        note: { kind: "text", nullable: true, maxLength: 100 },
        custom: {
            kind: "jsonb",
            nullable: false,
            freeKeys: true,
            keys: { tier: { kind: "int", filter: true }, other: { kind: "text" } },
        },
    },
    indexes: [
        { name: "recent_idx", on: [{ desc: "updatedAt" }, { desc: "id" }] },
        { name: "stage_idx", on: ["stage", "name"], where: { op: "notNull", field: "note" } },
    ],
    constraints: [
        { kind: "unique", name: "ws_name_key", on: ["name"], refusal: "taken" },
        { kind: "check", name: "note_len", expr: { op: "notNull", field: "note" }, refusal: "short" },
        { kind: "noOverlap", name: "no_overlap", equal: [], range: ["a", "b"], refusal: "overlap" },
    ],
}

const lead: EntityDefinition = { ...plain, view: true }

const P = "records_sales_lead"

const baseOf = (name: string, privileges: ReadonlyArray<string>): CatalogBase => ({
    name,
    rlsEnabled: true,
    rlsForced: true,
    policies: COMMANDS.map((command) => ({
        name: `${name}_app_engine_${command}`,
        roles: ["app_engine"],
        command,
        permissive: true,
        qual: command === "insert" ? null : QUAL,
        check: command === "insert" || command === "update" ? QUAL : null,
    })),
    grants: [{ role: "app_engine", privileges }],
})

const bases = (): ReadonlyArray<CatalogBase> => [
    baseOf("records", ["select", "insert", "update"]),
    baseOf("record_links", ["select", "insert", "update", "delete"]),
    baseOf("entity_sequences", ["select", "insert", "update"]),
]

const index = (
    name: string,
    columns: ReadonlyArray<string>,
    unique = false,
    method = "btree",
    predicate: string | null = null,
) => ({
    name,
    columns,
    unique,
    method,
    predicate,
})

const check = (name: string, definition: string, validated = true): CatalogConstraint => ({
    name,
    kind: "check",
    definition,
    validated,
})

/** The catalog of a database that already matches `lead`. */
const partition = (): CatalogPartition => ({
    name: P,
    bound: "sales.lead",
    constraints: [
        check(`${P}_name_chk`, "CHECK ((char_length((data ->> 'name'::text)) <= 200))"),
        check(`${P}_stage_chk`, "CHECK (((data ->> 'stage'::text) = ANY (ARRAY['new'::text, 'won'::text])))"),
        check(`${P}_note_chk`, "CHECK ((char_length((data ->> 'note'::text)) <= 100))"),
        check(`${P}_custom_chk`, "CHECK ((jsonb_typeof((data -> 'custom'::text)) = 'object'::text))"),
        check(`${P}_note_len`, "CHECK ((data ? 'note'::text))"),
        {
            name: `${P}_no_overlap`,
            kind: "exclude",
            definition: "EXCLUDE USING gist (workspace_id WITH =)",
            validated: true,
        },
        { name: `${P}_pkey`, kind: "primary", definition: "PRIMARY KEY (entity, id)", validated: true },
        { name: `${P}_fk`, kind: "foreign", definition: "FOREIGN KEY (x) REFERENCES y (z)", validated: true },
    ],
    indexes: [
        index(`${P}_recent_idx`, ["workspace_id", "updated_at DESC", "id DESC"]),
        index(
            `${P}_stage_idx`,
            ["workspace_id", "(data ->> 'stage'::text)", "(data ->> 'name'::text)"],
            false,
            "btree",
            "(data ? 'note'::text)",
        ),
        index(`${P}_ws_name_key`, ["workspace_id", "(data ->> 'name'::text)"], true),
        index(
            `${P}_name_trgm_idx`,
            ["public.knowledge_fold((data ->> 'name'::text)) public.gin_trgm_ops"],
            false,
            "gin",
        ),
        index(`${P}_custom_tier_idx`, ["workspace_id", "(((data -> 'custom'::text) ->> 'tier'::text))::integer"]),
        index(`${P}_custom_gin_idx`, ["(data -> 'custom'::text)"], false, "gin"),
        index(`${P}_no_overlap`, ["workspace_id"], false, "gist"),
        index(`${P}_pkey`, ["entity", "id"], true),
    ],
})

const view = (): CatalogView => ({
    name: `v_${P}`,
    columns: [
        { name: "id", type: "uuid" },
        { name: "workspace_id", type: "uuid" },
        { name: "version", type: "bigint" },
        { name: "created_at", type: "timestamp with time zone" },
        { name: "updated_at", type: "timestamp with time zone" },
        { name: "name", type: "character varying(200)" },
        { name: "stage", type: "text" },
        { name: "note", type: "text" },
        { name: "custom", type: "jsonb" },
    ],
})

const snapshot = (change: Partial<CatalogSnapshot> = {}): CatalogSnapshot => ({
    extensions: ["pg_trgm", "btree_gist"],
    bases: bases(),
    partitions: [partition()],
    views: [view()],
    ...change,
})

const summary = (ops: ReadonlyArray<PlanOp>): ReadonlyArray<string> =>
    ops.map((planned) => `${planned.kind}${planned.additive ? "" : "!"} ${planned.object}`)

const plan = (change: Partial<CatalogSnapshot>, entities: ReadonlyArray<EntityDefinition> = [lead]) =>
    summary(planOf(entities, snapshot(change)))

const withPartition = (change: (value: CatalogPartition) => CatalogPartition, extra: Partial<CatalogSnapshot> = {}) =>
    plan({ partitions: [change(partition())], ...extra })

const withCheck = (name: string, definition: string, validated = true) =>
    withPartition((value) => ({
        ...value,
        constraints: value.constraints.map((constraint) =>
            constraint.name === `${P}_${name}` ? { ...constraint, definition, validated } : constraint,
        ),
    }))

describe("planOf: a database that matches", () => {
    it("has an empty plan", () => {
        expect(plan({})).toEqual([])
    })
})

describe("planOf: an empty database", () => {
    const ops = planOf([lead], { extensions: [], bases: [], partitions: [], views: [] })

    it("asks for the base migration, the extensions, then the partition with its checks, indexes and view", () => {
        expect(summary(ops)).toEqual([
            "create_extension extension:pg_trgm",
            "create_extension extension:btree_gist",
            "base_missing! public.records",
            "base_missing! public.record_links",
            "base_missing! public.entity_sequences",
            `create_partition public.${P}`,
            `add_check public.${P}:constraint:${P}_name_chk`,
            `add_check public.${P}:constraint:${P}_stage_chk`,
            `add_check public.${P}:constraint:${P}_note_chk`,
            `add_check public.${P}:constraint:${P}_custom_chk`,
            `add_check public.${P}:constraint:${P}_note_len`,
            `add_exclude public.${P}:constraint:${P}_no_overlap`,
            `create_index public.${P}:index:${P}_recent_idx`,
            `create_index public.${P}:index:${P}_stage_idx`,
            `add_unique public.${P}:index:${P}_ws_name_key`,
            `create_index public.${P}:index:${P}_name_trgm_idx`,
            `create_index public.${P}:index:${P}_custom_tier_idx`,
            `create_index public.${P}:index:${P}_custom_gin_idx`,
            `create_view public.v_${P}`,
        ])
    })

    it("is additive except for the missing base", () => {
        expect(ops.filter((planned) => !planned.additive).map((planned) => planned.kind)).toEqual([
            "base_missing",
            "base_missing",
            "base_missing",
        ])
        expect(ops.find((planned) => planned.kind === "create_view")?.reason).toBe("typed view with 9 columns")
    })

    it("plans nothing for an entity with no fields, indexes, constraints or view", () => {
        const bare: EntityDefinition = { entry: "entity", name: "x.y", dataKind: "xy", fields: {} }
        expect(summary(planOf([bare], { extensions: [], bases: bases(), partitions: [], views: [] }))).toEqual([
            "create_partition public.records_x_y",
        ])
    })
})

describe("planOf: extensions", () => {
    it("asks only for what is missing", () => {
        expect(plan({ extensions: ["pg_trgm"] })).toEqual(["create_extension extension:btree_gist"])
        expect(plan({ extensions: ["btree_gist"] })).toEqual(["create_extension extension:pg_trgm"])
    })
})

describe("planOf: base tables", () => {
    const only = (name: string, change: Partial<CatalogBase>) =>
        plan({ bases: bases().map((base) => (base.name === name ? { ...base, ...change } : base)) })

    it("enables and forces RLS when off", () => {
        expect(only("records", { rlsEnabled: false, rlsForced: false })).toEqual([
            "enable_rls public.records",
            "force_rls public.records",
        ])
    })

    it("creates missing policies and refuses a policy with another definition", () => {
        const base = baseOf("records", ["select", "insert", "update"])
        expect(only("records", { policies: base.policies.filter((policy) => policy.command !== "delete") })).toEqual([
            "create_policy public.records:policy:records_app_engine_delete",
        ])
        const altered = (change: Partial<CatalogBase["policies"][number]>) =>
            only("records", {
                policies: base.policies.map((policy) =>
                    policy.command === "update" ? { ...policy, ...change } : policy,
                ),
            })
        const expected = ["alter_policy! public.records:policy:records_app_engine_update"]
        expect(altered({ roles: ["app_engine", "app_be"] })).toEqual(expected)
        expect(altered({ command: "all" })).toEqual(expected)
        expect(altered({ permissive: false })).toEqual(expected)
        expect(altered({ qual: null })).toEqual(expected)
        expect(altered({ qual: "(true)" })).toEqual(expected)
        expect(altered({ check: null })).toEqual(expected)
        expect(altered({ check: "(true)" })).toEqual(expected)
    })

    it("grants what is missing and revokes what the engine does not use", () => {
        expect(only("records", { grants: [] })).toEqual(["grant public.records:grant:app_engine"])
        expect(
            only("records", { grants: [{ role: "app_engine", privileges: ["SELECT", "INSERT", "UPDATE", "DELETE"] }] }),
        ).toEqual(["revoke! public.records:grant:app_engine"])
        expect(
            only("entity_sequences", { grants: [{ role: "app_engine", privileges: ["select", "truncate"] }] }),
        ).toEqual([
            "grant public.entity_sequences:grant:app_engine",
            "revoke! public.entity_sequences:grant:app_engine",
        ])
        expect(
            only("record_links", { grants: [{ role: "app_engine", privileges: ["select", "insert", "update"] }] }),
        ).toEqual(["grant public.record_links:grant:app_engine"])
    })

    it("grants delete on records only when an entity is deletable", () => {
        const deletable: EntityDefinition = { ...lead, deletable: true }
        expect(plan({}, [deletable])).toEqual(["grant public.records:grant:app_engine"])
    })
})

describe("planOf: partitions", () => {
    it("reports a partition that holds the entity under another name", () => {
        expect(withPartition((value) => ({ ...value, name: "records_other" }))).toEqual([
            "declaration_mismatch! public.records_other",
        ])
    })

    it("reports a partition name taken by another entity", () => {
        const names = plan({ partitions: [{ ...partition(), bound: "sales.other" }] })
        expect(names).toContain(`declaration_mismatch! public.${P}`)
        expect(names).toContain(`drop_partition! public.${P}`)
    })

    it("drops partitions and views no entity declares", () => {
        expect(
            plan({ partitions: [partition(), { ...partition(), name: "records_old", bound: "old.thing" }] }),
        ).toEqual(["drop_partition! public.records_old"])
        expect(plan({}, [])).toEqual([`drop_partition! public.${P}`, `drop_view! public.v_${P}`])
    })
})

describe("planOf: checks", () => {
    it("adds a missing check", () => {
        expect(
            withPartition((value) => ({
                ...value,
                constraints: value.constraints.filter((c) => c.name !== `${P}_note_chk`),
            })),
        ).toEqual([`add_check public.${P}:constraint:${P}_note_chk`])
    })

    it("does not take an exclude of the same name for a check", () => {
        expect(
            withPartition((value) => ({
                ...value,
                constraints: value.constraints.map((c) => (c.name === `${P}_note_chk` ? { ...c, kind: "exclude" } : c)),
            })),
        ).toEqual([`add_check public.${P}:constraint:${P}_note_chk`])
    })

    it("treats a value or a length the declaration drops as destructive", () => {
        const narrow = [`narrow_check! public.${P}:constraint:${P}_stage_chk`]
        expect(
            withCheck(
                "stage_chk",
                "CHECK (((data ->> 'stage'::text) = ANY (ARRAY['new'::text, 'won'::text, 'lost'::text])))",
            ),
        ).toEqual(narrow)
        expect(withCheck("name_chk", "CHECK ((char_length((data ->> 'name'::text)) <= 300))")).toEqual([
            `narrow_check! public.${P}:constraint:${P}_name_chk`,
        ])
    })

    it("treats a value or a length the declaration adds as additive", () => {
        expect(withCheck("stage_chk", "CHECK (((data ->> 'stage'::text) = 'new'::text))")).toEqual([
            `replace_check public.${P}:constraint:${P}_stage_chk`,
        ])
        expect(withCheck("name_chk", "CHECK ((char_length((data ->> 'name'::text)) <= 100))")).toEqual([
            `replace_check public.${P}:constraint:${P}_name_chk`,
        ])
    })

    it("does not read a length out of a check that has none", () => {
        expect(withCheck("name_chk", "CHECK ((data ? 'name'::text))")).toEqual([])
    })

    it("validates a check that was added NOT VALID, besides any change", () => {
        expect(withCheck("note_len", "CHECK ((data ? 'note'::text))", false)).toEqual([
            `validate_constraint public.${P}:constraint:${P}_note_len`,
        ])
        expect(withCheck("stage_chk", "CHECK (((data ->> 'stage'::text) = 'new'::text))", false)).toEqual([
            `replace_check public.${P}:constraint:${P}_stage_chk`,
            `validate_constraint public.${P}:constraint:${P}_stage_chk`,
        ])
    })

    it("adds a missing exclude", () => {
        expect(
            withPartition((value) => ({
                ...value,
                constraints: value.constraints.filter((c) => c.kind !== "exclude"),
                indexes: value.indexes.filter((i) => i.name !== `${P}_no_overlap`),
            })),
        ).toEqual([`add_exclude public.${P}:constraint:${P}_no_overlap`])
    })
})

describe("planOf: indexes", () => {
    const withIndex = (change: (value: CatalogPartition["indexes"]) => CatalogPartition["indexes"]) =>
        withPartition((value) => ({ ...value, indexes: change(value.indexes) }))

    it("creates a missing index, and satisfies one that sits under another name", () => {
        expect(withIndex((all) => all.filter((i) => i.name !== `${P}_recent_idx`))).toEqual([
            `create_index public.${P}:index:${P}_recent_idx`,
        ])
        expect(
            withIndex((all) => all.map((i) => (i.name === `${P}_recent_idx` ? { ...i, name: "renamed" } : i))),
        ).toEqual([])
    })

    it("refuses to guess when an index of the right name has another definition", () => {
        const altered = (change: Partial<CatalogPartition["indexes"][number]>) =>
            withIndex((all) => all.map((i) => (i.name === `${P}_recent_idx` ? { ...i, ...change } : i)))
        const expected = [`alter_index! public.${P}:index:${P}_recent_idx`]
        expect(altered({ unique: true })).toEqual(expected)
        expect(altered({ method: "hash" })).toEqual(expected)
        expect(altered({ predicate: "x" })).toEqual(expected)
        expect(altered({ columns: ["workspace_id"] })).toEqual(expected)
        expect(altered({ columns: ["workspace_id", "updated_at DESC", "other DESC"] })).toEqual(expected)
    })

    it("adds a missing unique", () => {
        expect(withIndex((all) => all.filter((i) => i.name !== `${P}_ws_name_key`))).toEqual([
            `add_unique public.${P}:index:${P}_ws_name_key`,
        ])
    })

    it("drops an index the declaration does not name, but not the key or a constraint's index", () => {
        expect(withIndex((all) => [...all, index(`${P}_stray`, ["workspace_id", "(data ->> 'x'::text)"])])).toEqual([
            `drop_index! public.${P}:index:${P}_stray`,
        ])
    })

    it("drops a check, unique or exclude constraint the declaration does not name", () => {
        expect(
            withPartition((value) => ({
                ...value,
                constraints: [
                    ...value.constraints,
                    check(`${P}_stray_chk`, "CHECK (true)"),
                    { name: `${P}_stray_key`, kind: "unique", definition: "UNIQUE (x)", validated: true },
                    { name: `${P}_stray_ex`, kind: "exclude", definition: "EXCLUDE ...", validated: true },
                ],
            })),
        ).toEqual([
            `drop_constraint! public.${P}:constraint:${P}_stray_chk`,
            `drop_constraint! public.${P}:constraint:${P}_stray_key`,
            `drop_constraint! public.${P}:constraint:${P}_stray_ex`,
        ])
    })
})

describe("planOf: views", () => {
    const withView = (change: (value: CatalogView) => CatalogView) => plan({ views: [change(view())] })

    it("creates a missing view", () => {
        expect(plan({ views: [] })).toEqual([`create_view public.v_${P}`])
    })

    it("accepts character varying for text", () => {
        expect(withView((value) => value)).toEqual([])
    })

    it("alters a view whose columns differ", () => {
        const expected = [`alter_view! public.v_${P}`]
        expect(withView((value) => ({ ...value, columns: value.columns.slice(0, 5) }))).toEqual(expected)
        expect(
            withView((value) => ({
                ...value,
                columns: value.columns.map((c) => (c.name === "stage" ? { ...c, name: "phase" } : c)),
            })),
        ).toEqual(expected)
        expect(
            withView((value) => ({
                ...value,
                columns: value.columns.map((c) => (c.name === "stage" ? { ...c, type: "integer" } : c)),
            })),
        ).toEqual(expected)
    })

    it("drops a view the entity no longer declares", () => {
        expect(plan({}, [plain])).toEqual([`drop_view! public.v_${P}`])
    })
})
