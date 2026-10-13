import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { MusicStore } from "./video-music.contracts"

/** Token of the file store the beds are written to; the app root binds it to the storage integration. */
export const MUSIC_STORE: unique symbol = Symbol("domain.video-music.store")

/** Injects the file store of the beds. Parameter type: MusicStore. */
export const InjectMusicStore = (): TypedParameterDecorator<MusicStore> => injector<MusicStore>(MUSIC_STORE)
