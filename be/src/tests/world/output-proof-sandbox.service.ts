import assert from "node:assert/strict"
import { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { WorldSandbox } from "./test-world.contracts"

/** Uses the coordinator's private fully migrated database; its owner retains it for receipts and removes it after the wave. */
export const outputProofSandbox = (): WorldSandbox => ({
    create(): Promise<string> {
        const url = parsePrimaryDatabaseConfig(EnvSource.fromProcess()).url.reveal()
        const database = new URL(url).pathname
        assert(
            /^\/nivo_output_proof_[a-z0-9_]+$/.test(database),
            "Output proofs require a coordinator-provisioned private nivo_output_proof_* database",
        )
        return Promise.resolve(url)
    },
    drop: () => Promise.resolve(),
})
