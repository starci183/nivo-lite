/** Words a Vietnamese colleague is addressed with before the given name; they never make a handle. */
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

const MAX_HANDLE = 16

const fold = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/\([^)]*\)/g, " ")

/** The handle of one name before de-duplication: the given name, folded to letters and digits. */
const baseHandleOf = (name: string): string => {
    const words = fold(name)
        .split(/[^a-z0-9]+/)
        .filter(Boolean)
    const named = words.filter((word) => !HONORIFICS.has(word))
    const pick = named.at(-1) ?? words.at(-1) ?? "staff"
    return pick.slice(0, MAX_HANDLE) || "staff"
}

/** The next free handle: `base`, then `base2`, `base3`... */
const freeHandle = (base: string, taken: ReadonlySet<string>): string => {
    let handle = base
    for (let n = 2; taken.has(handle); n += 1) handle = `${base}${n}`
    return handle
}

/** The @handle of every staff member given: unique, and clear of the reserved handles (agents and @nivo). */
export const staffHandlesOf = (
    staff: ReadonlyArray<{ readonly id: string; readonly name: string }>,
    reserved: ReadonlyArray<string>,
): ReadonlyMap<string, string> => {
    const taken = new Set<string>(["nivo", ...reserved.map((handle) => handle.toLowerCase())])
    const handles = new Map<string, string>()
    staff.forEach((member) => {
        const handle = freeHandle(baseHandleOf(member.name), taken)
        taken.add(handle)
        handles.set(member.id, handle)
    })
    return handles
}
