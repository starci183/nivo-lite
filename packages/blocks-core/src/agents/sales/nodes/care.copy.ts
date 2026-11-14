import samples from "./care.samples.json"

/** A key of the care sample texts: customer words the specs use as data. */
export type CareSampleKey = keyof typeof samples

/** The sample text of a key. */
export const careSample = (key: CareSampleKey): string => samples[key]
