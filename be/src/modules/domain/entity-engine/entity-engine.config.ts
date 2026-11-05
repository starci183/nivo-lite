import type { EnvSource } from "@modules/platform/config"
import type { EntityEngineConfig } from "./entity-engine.options"

/** Reads the entity engine configuration: `ENTITY_ENGINE_CURSOR_KEY` is the 32-byte base64 key that signs list cursors. */
export const parseEntityEngineConfig = (env: EnvSource): EntityEngineConfig => ({
    cursorKey: env.secret("ENTITY_ENGINE_CURSOR_KEY"),
})
