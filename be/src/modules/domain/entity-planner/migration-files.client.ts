import { readFile, readdir, writeFile, mkdir } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { InjectEntityPlannerOptions } from "./entity-planner.port"
import type { EntityPlannerOptions } from "./entity-planner.options"

/** The migrations folder, relative to the app root. */
export const MIGRATIONS_DIRECTORY: string = join("db", "migrations")

/** The entities manifest the harness drift check compares, relative to the app root. */
export const MANIFEST_FILE: string = join(".starciwork", "entities.manifest.json")

const missing = (error: unknown): boolean =>
    typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"

@Injectable()
/** The files the planner reads and writes: the migrations folder and the entities manifest. */
export class MigrationFilesClient {
    private readonly root: string

    constructor(@InjectEntityPlannerOptions() options: EntityPlannerOptions) {
        this.root = options.root ?? "."
    }

    /** The names of the `*.sql` files in the migrations folder, in name order. */
    async names(): Promise<ReadonlyArray<string>> {
        const entries = await readdir(join(this.root, MIGRATIONS_DIRECTORY))
        return entries.filter((name) => name.endsWith(".sql")).sort((left, right) => left.localeCompare(right))
    }

    /** The text of the migration with this name. */
    read(name: string): Promise<string> {
        return readFile(join(this.root, MIGRATIONS_DIRECTORY, name), "utf8")
    }

    /** Writes a new migration file; an existing file of that name is refused. */
    write(name: string, text: string): Promise<void> {
        return writeFile(join(this.root, MIGRATIONS_DIRECTORY, name), text, { encoding: "utf8", flag: "wx" })
    }

    /** The manifest text, or null when it has not been written yet. */
    async manifest(): Promise<string | null> {
        try {
            return await readFile(join(this.root, MANIFEST_FILE), "utf8")
        } catch (error) {
            if (missing(error)) return null
            throw error
        }
    }

    /** Writes the manifest, creating its folder. */
    async writeManifest(text: string): Promise<void> {
        await mkdir(join(this.root, ".starciwork"), { recursive: true })
        await writeFile(join(this.root, MANIFEST_FILE), text, "utf8")
    }
}
