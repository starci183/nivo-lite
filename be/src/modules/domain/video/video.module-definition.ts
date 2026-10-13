import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InjectionToken } from "@nestjs/common"
import { VIDEO_ASSETS, VIDEO_OPTIONS } from "./video.decorators"
import type { VideoOptions } from "./video.options"

/** Composition choices supplied by the app root rather than injected video options. */
interface VideoModuleExtras {
    /** Whether the capability is visible throughout the importing app. */
    readonly isGlobal: boolean
    /** The existing storage provider to expose through the video asset port. */
    readonly assets?: InjectionToken
}

/** The configurable-module base of the video capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<VideoOptions>({
    optionsInjectionToken: VIDEO_OPTIONS,
})
    .setExtras<VideoModuleExtras>({ isGlobal: false, assets: undefined }, (definition, extras) => ({
        ...definition,
        global: extras.isGlobal,
        providers: [
            ...(definition.providers ?? []),
            ...(extras.assets === undefined ? [] : [{ provide: VIDEO_ASSETS, useExisting: extras.assets }]),
        ],
        exports: [...(definition.exports ?? []), ...(extras.assets === undefined ? [] : [VIDEO_ASSETS])],
    }))
    .build()
