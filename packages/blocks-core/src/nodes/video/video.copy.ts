import type { BilingualText } from "../../messages/catalog"
import type { NodeLocale } from "../node-schema.types"
import en from "./video.en.json"
import vi from "./video.vi.json"

/** A key of the video nodes' copy: their titles and the team lines they post. */
export type VideoCopyKey = keyof typeof vi

/** The words of a key in both product languages, for a node title. */
export const videoTitle = (key: VideoCopyKey): BilingualText => ({ vi: vi[key], en: en[key] })

/** The words of a key in one language. */
export const videoLine = (locale: NodeLocale, key: VideoCopyKey): string => (locale === "vi" ? vi : en)[key]
