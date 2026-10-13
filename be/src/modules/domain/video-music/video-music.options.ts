import type { InjectionToken } from "@nestjs/common"

/** What the video-music capability needs from the composition root. */
export interface VideoMusicOptions {
    /** The provider token of the file store (a `MusicStore`) in the app: the storage integration. */
    readonly store: InjectionToken
}
