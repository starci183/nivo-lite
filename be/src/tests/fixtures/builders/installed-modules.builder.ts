import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { INSTALLED } from "@modules/domain/installed-plugins"

/**
 * The declarations of the modules of every PUBLIC installed plugin (the modules any workspace may install), in installation order: the
 * list a spec walks when it proves a rule "for every module", read from the installation and never from a package by name.
 */
export const installedModules = (): ReadonlyArray<ModuleDeclaration> =>
    INSTALLED.plugins
        .filter((plugin) => plugin.visibility === "public")
        .flatMap((plugin) => plugin.modules)
        .flatMap((key) => {
            const declaration = INSTALLED.moduleOf(key)
            return declaration === null ? [] : [declaration]
        })
