import { rmSync } from "node:fs"
import { dirname } from "node:path"

/** The variable through which the world runner found the state file of this run. */
const STATE_FILE_ENV = "STARCI_TEST_WORLD_STATE"

/** `starci app db` and the dev database container own startup, migrations and shutdown; the teardown removes only the state file its setup wrote. */
export default function lifecycle(): Promise<void> {
    const file = process.env[STATE_FILE_ENV]
    if (file !== undefined && file !== "") rmSync(dirname(file), { recursive: true, force: true })
    return Promise.resolve()
}
