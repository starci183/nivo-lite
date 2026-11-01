import { readFile } from "node:fs/promises"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "./primary.decorators"

const SEED_FILE = "db/seed.sql"

@Injectable()
/** Executes the one tracked Supabase seed through the shared least-privilege EntityManager. */
export class SeedRunnerService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Reads and executes the tracked seed when it contains at least one statement. */
    async run(): Promise<void> {
        const text = await readFile(SEED_FILE, "utf8")
        if (text.trim() !== "") await this.entityManager.query(text)
    }
}
