import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ModulesOptions } from "./modules.options"
import type { RecordInstallationSource } from "./modules.port"

/** Token of the modules options, exported so a spec can provide it. */
export const MODULES_OPTIONS: unique symbol = Symbol("domain.modules.options")

/** Injects the options of the modules capability. Parameter type: ModulesOptions. */
export const InjectModulesOptions = (): TypedParameterDecorator<ModulesOptions> =>
    injector<ModulesOptions>(MODULES_OPTIONS)

/** Token of the record installation sources (the capabilities that keep records naming an installation); empty in an app that binds none. */
export const RECORD_INSTALLATION_SOURCES: unique symbol = Symbol("domain.modules.record-sources")

/** Injects the record installation sources. Parameter type: ReadonlyArray<RecordInstallationSource>. */
export const InjectRecordInstallationSources = (): TypedParameterDecorator<ReadonlyArray<RecordInstallationSource>> =>
    injector<ReadonlyArray<RecordInstallationSource>>(RECORD_INSTALLATION_SOURCES)
