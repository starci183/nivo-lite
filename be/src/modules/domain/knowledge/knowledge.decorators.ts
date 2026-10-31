import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DriveAccessSource } from "./knowledge.contracts"
import type { KnowledgeFullOptions, KnowledgeOptions } from "./knowledge.options"

/** Token of the options of the knowledge capability, exported so a spec can provide it. */
export const KNOWLEDGE_OPTIONS: unique symbol = Symbol("domain.knowledge.options")

/** Injects the options of the knowledge capability. Parameter type: KnowledgeOptions. */
export const InjectKnowledgeOptions = (): TypedParameterDecorator<KnowledgeOptions> =>
    injector<KnowledgeOptions>(KNOWLEDGE_OPTIONS)

/** Token of the Google Drive access source the app root binds, exported so a spec can provide it. */
export const DRIVE_ACCESS_SOURCE: unique symbol = Symbol("domain.knowledge.drive-access-source")

/** Injects the Google Drive access source. Parameter type: DriveAccessSource. */
export const InjectDriveAccessSource = (): TypedParameterDecorator<DriveAccessSource> =>
    injector<DriveAccessSource>(DRIVE_ACCESS_SOURCE)

/** Injects the options of the full knowledge capability (the indexing side; the search-only mode never builds it). Parameter type: KnowledgeFullOptions. */
export const InjectKnowledgeFullOptions = (): TypedParameterDecorator<KnowledgeFullOptions> =>
    injector<KnowledgeFullOptions>(KNOWLEDGE_OPTIONS)
