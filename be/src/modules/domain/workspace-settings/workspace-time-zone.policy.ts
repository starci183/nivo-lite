/** The IANA names the platform knows, with UTC (which the list leaves out). */
const KNOWN = new Set<string>([...Intl.supportedValuesOf("timeZone"), "UTC"])

/** Whether the platform knows the name as an IANA time zone. */
export const isKnownTimeZone = (name: string): boolean => KNOWN.has(name)

/** The time zone a stored setting names; the default when none is stored or the platform does not know the name. */
export const timeZoneOrDefault = (stored: unknown, fallback: string): string =>
    typeof stored === "string" && KNOWN.has(stored) ? stored : fallback
