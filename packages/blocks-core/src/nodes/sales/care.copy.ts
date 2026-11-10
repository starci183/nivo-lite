import type { BilingualText } from "../../messages/catalog"
import en from "./care.en.json"
import samples from "./care.samples.json"
import vi from "./care.vi.json"

/** A key of the care copy: the titles of the care effects, in Vietnamese and in English. No customer line lives here: the agents write them. */
export type CareKey = keyof typeof vi

/** A key of the care sample texts: customer words the specs use as data. */
export type CareSampleKey = keyof typeof samples

/** The words of a care key in both product languages, for an effect title. */
export const careTitle = (key: CareKey): BilingualText => ({ vi: vi[key], en: en[key] })

/** The sample text of a key. */
export const careSample = (key: CareSampleKey): string => samples[key]
