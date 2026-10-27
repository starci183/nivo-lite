import { spawn } from "node:child_process"
import { Injectable } from "@nestjs/common"
import { DatabaseError, DatabaseErrorCode } from "./errors/database.error"

const runDbPush = (): Promise<void> =>
    new Promise((resolve, reject) => {
        const command = process.platform === "win32" ? "npm.cmd" : "npm"
        const child = spawn(command, ["run", "db:push"], { stdio: "inherit" })
        child.once("error", (cause: unknown) =>
            reject(new DatabaseError({ code: DatabaseErrorCode.MigrationFailed, cause })),
        )
        child.once("exit", (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(
                new DatabaseError({
                    code: DatabaseErrorCode.MigrationFailed,
                    params: { status: code ?? "without a status" },
                }),
            )
        })
    })

@Injectable()
/** The lite migration runner delegates the Supabase schema authority to the managed db:push wrapper. */
export class MigrationRunnerService {
    /** Runs the managed wrapper and propagates a CLI or migration failure. */
    async run(): Promise<void> {
        await runDbPush()
    }
}
