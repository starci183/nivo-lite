import { Injectable } from "@nestjs/common"
import {
    ENTITY_PLAN_DESTRUCTIVE,
    destructiveOps,
    manifestOf,
    parseCatalogSnapshot,
    planOf,
    renderMigration,
    type CatalogSnapshot,
    type EntityManifest,
    type PlanOp,
} from "@nivo-lite/agent-sdk/entity"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { parseJsonText } from "@modules/platform/primitives"
import { InjectEntityPlannerOptions } from "./entity-planner.port"
import type { EntityPlannerOptions } from "./entity-planner.options"
import { EntityPlannerError, EntityPlannerErrorCode } from "./errors/entity-planner.error"
import { MigrationFilesClient } from "./migration-files.client"

/** What `cli entities plan` was asked: each flag is present when given. */
export interface EntityPlanOptions {
    /** Write the migration and the manifest instead of only printing the plan. */
    readonly write?: true
    /** Allow a plan that drops or narrows; the file is then a `*_contract_*` migration (R259). */
    readonly contract?: true
}

const STAMP = /^(\d{14})_/

/** The stamp after the highest committed one (R213): a generated migration always sorts last. */
const nextStampOf = (names: ReadonlyArray<string>): string => {
    const stamps = names.flatMap((name) => STAMP.exec(name)?.[1] ?? [])
    const highest = stamps.reduce((best, stamp) => (BigInt(stamp) > BigInt(best) ? stamp : best), "00000000000000")
    return String(BigInt(highest) + 1n).padStart(14, "0")
}

/** The text of the manifest file: stable JSON with a closing newline. */
const manifestTextOf = (manifest: EntityManifest): string => `${JSON.stringify(manifest, null, 2)}
`

/**
 * Whether the manifest file says what the declarations say. The file is compared as JSON, not as text: the commit hook formats it
 * with prettier, which folds short arrays, so the bytes the planner wrote and the bytes committed may differ.
 */
const manifestMatches = (text: string | null, expected: EntityManifest): boolean => {
    if (text === null) return false
    const read = parseJsonText(text)
    return read.ok && JSON.stringify(read.value) === JSON.stringify(expected)
}

/** Where the planner prints: `process.stdout` in the cli. */
export interface EntityPlanOutput {
    /** Writes one chunk of text. */
    write(text: string): unknown
}

/** The catalog function row: the jsonb under the function's name. */
interface CatalogRow {
    readonly engine_catalog?: unknown
}

@Injectable()
/** Diffs the entity declarations against the live catalog, prints the plan, and writes the migration and the manifest. */
export class EntityPlannerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectEntityPlannerOptions() private readonly options: EntityPlannerOptions,
        private readonly files: MigrationFilesClient,
    ) {}

    /** Prints the plan; with `write` it also writes the next migration and the manifest, and refuses a destructive plan without `contract`. */
    async plan(options: EntityPlanOptions, out: EntityPlanOutput): Promise<void> {
        const ops = await this.diff()
        out.write(this.reportOf(ops))
        const destructive = destructiveOps(ops)
        if (destructive.length > 0 && options.contract === undefined) {
            throw new EntityPlannerError({
                code: EntityPlannerErrorCode.PlanDestructive,
                params: { exit: ENTITY_PLAN_DESTRUCTIVE, steps: destructive.length },
            })
        }
        if (options.write === undefined) return
        if (ops.length > 0) await this.writeMigration(ops, options.contract)
        await this.files.writeManifest(manifestTextOf(manifestOf(this.options.entities)))
    }

    /** Fails unless the database and the manifest file both match the declarations. */
    async check(out: EntityPlanOutput): Promise<void> {
        const ops = await this.diff()
        out.write(this.reportOf(ops))
        if (ops.length > 0) {
            throw new EntityPlannerError({ code: EntityPlannerErrorCode.PlanNotEmpty, params: { steps: ops.length } })
        }
        if (!manifestMatches(await this.files.manifest(), manifestOf(this.options.entities))) {
            throw new EntityPlannerError({ code: EntityPlannerErrorCode.ManifestMismatch })
        }
    }

    private async diff(): Promise<ReadonlyArray<PlanOp>> {
        return planOf(this.options.entities, await this.snapshot())
    }

    private async snapshot(): Promise<CatalogSnapshot> {
        const [row] = await callDbFunction<CatalogRow>(this.entityManager, "public.engine_catalog", [])
        const parsed = parseCatalogSnapshot(row?.engine_catalog)
        if (!parsed.ok) {
            throw new EntityPlannerError({
                code: EntityPlannerErrorCode.CatalogInvalid,
                params: { issues: parsed.issues.join("; ") },
            })
        }
        return parsed.snapshot
    }

    private async writeMigration(ops: ReadonlyArray<PlanOp>, contract: true | undefined): Promise<void> {
        const names = await this.files.names()
        const rendered = renderMigration(
            ops,
            this.options.entities,
            nextStampOf(names),
            contract === undefined ? {} : { contract },
        )
        if (!rendered.ok) {
            throw new EntityPlannerError({
                code: EntityPlannerErrorCode.RenderRefused,
                params: {
                    problems: rendered.problems.map((problem) => `${problem.code} ${problem.object}`).join("; "),
                },
            })
        }
        const texts = await Promise.all(names.map((name) => this.files.read(name)))
        const same = names.find((_, index) => texts[index] === rendered.sql)
        if (same !== undefined) {
            throw new EntityPlannerError({ code: EntityPlannerErrorCode.AlreadyWritten, params: { file: same } })
        }
        await this.files.write(rendered.file, rendered.sql)
    }

    private reportOf(ops: ReadonlyArray<PlanOp>): string {
        if (ops.length === 0) return "entities: the database matches the declarations\n"
        const steps = ops.map((op) => `${op.additive ? "+" : "!"} ${op.kind} ${op.object}: ${op.reason}`)
        return `${steps.join("\n")}\n`
    }
}
