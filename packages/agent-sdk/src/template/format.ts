/** The format number of a package; a package of another format is not read. */
export const TEMPLATE_FORMAT = 1

/** The shape of a template key. */
export const TEMPLATE_KEY_PATTERN: RegExp = /^[a-z][a-z0-9-]{2,59}$/

/** The most parameters a package declares. */
export const MAX_PARAMETERS = 20
