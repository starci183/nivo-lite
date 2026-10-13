import type { InjectionToken } from "@nestjs/common"

/** What the video capability needs from the environment. */
export interface VideoOptions {
    /** Where the bundled fonts live (be/src/assets/fonts, copied into the image); the music beds come from the media bucket. */
    readonly fontsDir: string
    /** Scratch space for one render; removed when the render ends (stale ones are swept at start). */
    readonly workDir: string
    /** The longest video in seconds the renderer accepts. */
    readonly maxSeconds: number
    /** ffmpeg threads per render. */
    readonly ffmpegThreads: number
}

/** What the app root registers the video capability with: the environment options and the file store binding. */
export interface VideoRegistration extends VideoOptions {
    /** The provider token of the file store (a `VideoAssets`) in the app; the root binds it to the storage integration. */
    readonly assets: InjectionToken
}
