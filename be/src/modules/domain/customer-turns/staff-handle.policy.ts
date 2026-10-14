/** Words of address that are not part of a colleague's name. */
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
const HANDLE_MAX = 16
const COMBINING_MARKS = new RegExp(`[${String.fromCodePoint(0x300)}-${String.fromCodePoint(0x36f)}]`, "gu")
const D_STROKE = new RegExp(String.fromCodePoint(0x111), "gu")
/** Roles that answer customers first (advisor, sales, customer care), matched without accents. */
const ADVISOR_ROLE = /tu van|sales|ban hang|kinh doanh|cskh|cham soc khach|advis|consult/u

/** Lowercase, accents and parentheses removed. */
export const foldText = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .replace(D_STROKE, "d")
        .replace(/\([^)]*\)/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()

/** The base handle of a name: a Vietnamese colleague is called by the given name, the last word without its title ("Chi Ha" -> ha). */
export const baseHandleOf = (name: string): string => {
    const words = foldText(name)
        .split(/[^a-z0-9]+/u)
        .filter((word) => word !== "")
    const named = words.filter((word) => !HONORIFICS.has(word))
    return (named.at(-1) ?? words.at(-1) ?? "staff").slice(0, HANDLE_MAX)
}

/** The handle of one staff member among the staff in the order every screen uses: a second "Ha" becomes ha2, and nivo is reserved. */
export const handleAmong = (
    staff: ReadonlyArray<{ readonly id: string; readonly name: string }>,
    staffId: string,
): string => {
    const handles = staff.reduce<{ readonly taken: ReadonlySet<string>; readonly mine: string }>(
        (state, member) => {
            const base = baseHandleOf(member.name)
            const free = (n: number): string => {
                const candidate = n === 1 ? base : `${base}${n}`
                return state.taken.has(candidate) ? free(n + 1) : candidate
            }
            const handle = free(1)
            return { taken: new Set([...state.taken, handle]), mine: member.id === staffId ? handle : state.mine }
        },
        { taken: new Set(["nivo"]), mine: "staff" },
    )
    return handles.mine
}

/** True when a role answers customers first. */
export const isAdvisorRole = (role: string): boolean => ADVISOR_ROLE.test(foldText(role))
