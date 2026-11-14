import samples from "./front-desk.samples.json"

/** A key of the front-desk sample texts: customer and shop words the examples and specs use as data. */
export type FrontDeskSampleKey = keyof typeof samples

/** The sample text of a key. */
export const frontDeskSample = (key: FrontDeskSampleKey): string => samples[key]
