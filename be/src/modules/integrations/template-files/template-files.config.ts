import type { EnvSource } from "@modules/platform/config"
import type { TemplateFilesOptions } from "./template-files.options"

const DEFAULT_ROOT = "resources"

/** Reads the folder of the definition files; it defaults to `resources` under the folder the app starts in. */
export const parseTemplateFilesConfig = (env: EnvSource): TemplateFilesOptions => ({
    root: env.optional("TEMPLATE_RESOURCES_DIR") ?? DEFAULT_ROOT,
})
