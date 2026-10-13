/**
 * Office @handles of the staff (the same rule the Office screen uses). A Vietnamese colleague is called by the given name with the
 * honorific dropped and the accents folded ("Chi Ha" gives @ha, "Nguyen Van Minh" gives @minh). Handles are unique among the staff passed
 * in (in that order) and never collide with a reserved handle (agents, @nivo): a second "Ha" becomes @ha2. Pass the active staff oldest
 * first everywhere so every screen agrees.
 */
const HONORIFICS: ReadonlySet<string> = new Set([
    "anh",
    "chi",
    "em",
    "co",
    "chu",
    "ong",
    "ba",
    "bac",
    "di",
    "thay",
    "mr",
    "mrs",
    "ms",
    "sep",
])

const fold = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/gu, "")
        .replace(/\u0111/gu, "d")
        .replace(/\([^)]*\)/gu, " ")

/** The base handle of one name, before de-duplication. */
export const baseStaffHandle = (name: string): string => {
    const words = fold(name)
        .split(/[^a-z0-9]+/u)
        .filter((word) => word !== "")
    const named = words.filter((word) => !HONORIFICS.has(word))
    const pick = named.at(-1) ?? words.at(-1) ?? "staff"
    return pick.slice(0, 16) || "staff"
}

/** One staff member a handle is made for. */
export interface HandleSource {
    /** The staff row id. */
    readonly id: string
    /** The name. */
    readonly name: string
}

/** id -> handle for every staff member given, unique and clear of the reserved handles. */
export const staffHandles = (
    staff: ReadonlyArray<HandleSource>,
    reserved: ReadonlyArray<string> = [],
): ReadonlyMap<string, string> => {
    const taken = new Set(["nivo", ...reserved.map((handle) => handle.toLowerCase())])
    return new Map(
        staff.map((person) => {
            const base = baseStaffHandle(person.name)
            let handle = base
            for (let n = 2; taken.has(handle); n += 1) handle = `${base}${n}`
            taken.add(handle)
            return [person.id, handle] as const
        }),
    )
}
