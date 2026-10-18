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

const withoutParentheses = (text: string): string => {
    let cursor = 0
    let out = ""
    while (cursor < text.length) {
        const opening = text.indexOf("(", cursor)
        if (opening < 0) break
        const closing = text.indexOf(")", opening + 1)
        if (closing < 0) break
        out += text.slice(cursor, opening) + " "
        cursor = closing + 1
    }
    return out + text.slice(cursor)
}

const fold = (text: string): string =>
    withoutParentheses(
        text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/gu, "")
            .replaceAll("\u0111", "d"),
    )

/** The base handle of one name, before de-duplication. */
export const baseStaffHandle = (name: string): string => {
    const words = fold(name)
        .split(/[^a-z0-9]+/u)
        .filter((word) => word !== "")
    const named = words.filter((word) => !HONORIFICS.has(word))
    const pick = named.at(-1) ?? words.at(-1) ?? "staff"
    return pick.slice(0, 16)
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
            let suffix = 2
            while (taken.has(handle)) {
                handle = `${base}${suffix}`
                suffix += 1
            }
            taken.add(handle)
            return [person.id, handle] as const
        }),
    )
}
