import { resolve } from "node:path"
import type { EnvSource } from "@modules/platform/config"

/** The folder manual imports are read from: INBOUND_IMPORT_ROOT, else the `.starciwork` folder of the directory the app runs in. */
export const parseChatFilesImportRoot = (env: EnvSource): string =>
    resolve(env.optional("INBOUND_IMPORT_ROOT") ?? ".starciwork")
