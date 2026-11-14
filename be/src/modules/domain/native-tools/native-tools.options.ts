import type { Type } from "@nestjs/common"
import type { ProviderFileSink } from "@modules/domain/provider-registry"

/** What the app binds for the native tools; the app root decides whether the capability is global. */
export interface NativeToolsOptions {
    /**
     * Where the generic media tools keep a provider's file (`PROVIDER_FILE_SINK`: the records' file store, `RecordFileSinkService`); absent,
     * a speech clip is refused `file_store_unavailable` and an async job's files are answered as handles only.
     */
    readonly fileSink?: Type<ProviderFileSink>
}
