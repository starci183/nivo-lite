/** The ports a public mail server listens on. */
export const PUBLIC_MAIL_PORTS: ReadonlySet<number> = new Set([25, 465, 587, 2465, 2525, 2587])

/** True when the port is a valid TCP port. */
export const isValidPort = (port: number): boolean => Number.isInteger(port) && port >= 1 && port <= 65535
