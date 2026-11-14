/** The longest enterprise identifier. */
export const ENTERPRISE_KEY_MAX = 40

/** The shape of an enterprise identifier: a lowercase slug (`nivo-web`), the shape a plugin names its enterprises in. */
const ENTERPRISE_KEY = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/

/** True for a text that may be the enterprise identifier of a workspace. */
export const isEnterpriseKey = (text: string): boolean => text.length <= ENTERPRISE_KEY_MAX && ENTERPRISE_KEY.test(text)
