/** The longest bearer credential the gateway seals. */
const BEARER_MAX = 4096

/** True for a bearer credential worth sealing: not blank, without line breaks (it travels in a header), at most 4096 characters. */
export const isBearerCredential = (value: string): boolean =>
    value.trim() !== "" && value.length <= BEARER_MAX && !/[\r\n]/u.test(value)
