/** One choice of the time zone list: the zone's IANA name and the words the picker shows. */
export interface TimeZoneOption {
    readonly id: string
    readonly label: string
}

/** The IANA zones the platform knows, as this runtime lists them. */
export const knownTimeZones = (): ReadonlyArray<string> => Intl.supportedValuesOf("timeZone")

/** The words of one zone: its IANA name with the underscores as spaces, so a person can type "Ho Chi Minh" to find it. */
export const timeZoneLabelOf = (zone: string): string => zone.replaceAll("_", " ")

/**
 * The time zone choices in alphabetical order. The saved zone is always among them, even when this runtime does not list it, so
 * the picker never shows an empty value for a workspace that has one.
 */
export const timeZoneOptionsOf = (
    zones: ReadonlyArray<string>,
    current: string | undefined,
): ReadonlyArray<TimeZoneOption> => {
    const isMissing = current !== undefined && current !== "" && !zones.includes(current)
    const ids = isMissing ? [...zones, current] : zones
    return ids.toSorted((a, b) => a.localeCompare(b, "en")).map((id) => ({ id, label: timeZoneLabelOf(id) }))
}
