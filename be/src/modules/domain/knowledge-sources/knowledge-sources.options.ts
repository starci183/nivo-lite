import type { InjectionToken } from "@nestjs/common"

/** What the knowledge-sources capability needs from the composition root. */
export interface KnowledgeSourcesOptions {
    /** The provider token of the storage door (a `SupabaseStoragePort`) in the app. */
    readonly storage: InjectionToken
}
