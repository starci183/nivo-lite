import { factSlugOf } from "@modules/domain/brain-facts"
import type { EventKey, RoleKey } from "./dossier-inputs.contracts"

const slugs = (aliases: ReadonlyArray<string>): ReadonlyArray<string> => aliases.map(factSlugOf)

/** A value every document must agree on, the aliases of its attribute, and the dossier its finding is filed under. */
export interface Invariant {
    /** The invariant key. */
    readonly key: "charter_capital" | "tax_code"
    /** The attribute slugs that name it. */
    readonly attributes: ReadonlyArray<string>
    /** The reference of the dossier its finding is filed under. */
    readonly filedUnder: string
    /** The references whose documents are read first. */
    readonly authority: ReadonlyArray<string>
}

/** The charter capital: every document gives the same, the registration certificate and the charter first. */
export const CHARTER_CAPITAL: Invariant = {
    key: "charter_capital",
    attributes: slugs(["von dieu le", "charter capital"]),
    filedUnder: "2",
    authority: ["1", "2"],
}

/** The tax code of the company. */
export const TAX_CODE: Invariant = {
    key: "tax_code",
    attributes: slugs(["ma so thue", "mst", "tax code"]),
    filedUnder: "1",
    authority: ["1", "2"],
}

/** The invariants of the pack. */
export const INVARIANTS: ReadonlyArray<Invariant> = [CHARTER_CAPITAL, TAX_CODE]

/** The attribute slugs whose date marks each event. */
export const EVENT_ATTRIBUTES: Readonly<Record<EventKey, ReadonlyArray<string>>> = {
    capital_transfer: slugs([
        "ngay chuyen nhuong von",
        "ngay chuyen nhuong",
        "ngay chuyen nhuong phan von gop",
        "capital transfer date",
    ]),
    member_change: slugs(["ngay thay doi thanh vien", "ngay tiep nhan thanh vien", "member change date"]),
    registration_change: slugs(["ngay dang ky thay doi", "ngay thay doi dang ky", "registration change date"]),
    legal_rep_change: slugs([
        "ngay thay doi nguoi dai dien",
        "ngay thay doi nguoi dai dien theo phap luat",
        "legal representative change date",
    ]),
    role_change: slugs(["ngay bo nhiem", "ngay mien nhiem", "ngay giao nhiem vu", "appointment date"]),
}

/** The attribute slugs that name the holder of each role. */
export const ROLE_ATTRIBUTES: Readonly<Record<RoleKey, ReadonlyArray<string>>> = {
    accountant: slugs(["nguoi phu trach ke toan", "ke toan truong", "chief accountant", "accountant"]),
    legal_representative: slugs(["nguoi dai dien theo phap luat", "nguoi dai dien phap luat", "legal representative"]),
    director: slugs(["giam doc", "tong giam doc", "director", "general director"]),
    council_chair: slugs(["chu tich hoi dong thanh vien", "chu tich hdtv", "council chair"]),
    controller: slugs(["kiem soat vien", "controller"]),
    employee: slugs(["nguoi lao dong", "employee"]),
}

/** The attribute slugs of a fact about a person that names the role the person holds as its value. */
export const TITLE_ATTRIBUTES: ReadonlyArray<string> = slugs(["chuc danh", "chuc vu", "vai tro", "position", "role"])

/** The roles whose holders must be one person at a time. */
export const SOLE_ROLES: ReadonlyArray<RoleKey> = [
    "accountant",
    "legal_representative",
    "director",
    "council_chair",
    "controller",
]

/** The attribute slugs of a person's leaving date. */
export const LEAVE_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "ngay nghi viec",
    "ngay thoi viec",
    "cham dut hop dong",
    "ngay cham dut hop dong",
    "leaving date",
])

/** The attribute slugs of an expiry date. */
export const EXPIRY_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "ngay het han",
    "het han",
    "hieu luc den",
    "co hieu luc den",
    "expiry",
    "expires",
    "expiry date",
])

/** The attribute slugs of a contributed total. */
export const CONTRIBUTED_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "von da gop",
    "von thuc gop",
    "tong von gop",
    "contributed capital",
])

/** The attribute slugs of the date the company was first registered. */
export const REGISTRATION_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "ngay dang ky lan dau",
    "ngay thanh lap",
    "ngay cap lan dau",
    "registration date",
])

/** The attribute slugs of a member's ownership share in per cent. */
export const SHARE_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "ty le von gop",
    "ty le so huu",
    "ty le phan von gop",
    "ownership share",
])

/** The attribute slugs of a member's capital. */
export const MEMBER_CAPITAL_ATTRIBUTES: ReadonlyArray<string> = slugs(["phan von gop", "so von gop", "member capital"])

/** The attribute slugs of a wage. */
export const SALARY_ATTRIBUTES: ReadonlyArray<string> = slugs(["muc luong", "luong co ban", "luong", "salary"])

/** The attribute slugs of the date a document was signed, issued or took effect: the date the document bears. */
export const SIGNING_ATTRIBUTES: ReadonlyArray<string> = slugs([
    "ngay ky",
    "ngay ban hanh",
    "ngay hieu luc",
    "ngay lap",
    "signing date",
    "issue date",
])

/** A legal text no longer in force: the folded pattern of a citation of it, what replaced it and from when. */
export interface RepealedCitation {
    /** The citation key. */
    readonly key: string
    /** The pattern over folded passage text. */
    readonly pattern: RegExp
    /** How people cite it. */
    readonly label: string
    /** What replaced it. */
    readonly replacement: string
    /** From when, YYYY-MM-DD. */
    readonly since: string
}

/** The repealed texts the pack knows. */
export const REPEALED_CITATIONS: ReadonlyArray<RepealedCitation> = [
    {
        key: "nd_123_2020",
        pattern: /(?:nd|nghi dinh)\s*(?:so\s*)?123\/2020|123\/2020\/nd-cp/u,
        label: "ND 123/2020",
        replacement: "ND 254/2026",
        since: "2026-07-01",
    },
    {
        key: "nd_70_2025",
        pattern: /(?:nd|nghi dinh)\s*(?:so\s*)?70\/2025|70\/2025\/nd-cp/u,
        label: "ND 70/2025",
        replacement: "ND 254/2026",
        since: "2026-07-01",
    },
    {
        key: "tt_132_2018",
        pattern: /(?:tt|thong tu)\s*(?:so\s*)?132\/2018|132\/2018\/tt-btc/u,
        label: "TT 132/2018",
        replacement: "TT 58/2026",
        since: "2026-07-01",
    },
    {
        key: "pit_04_2007",
        pattern: /04\/2007\/qh12|(?:thue )?(?:thu nhap ca nhan|tncn)\s*(?:so\s*)?04\/2007/u,
        label: "Luat TNCN 04/2007",
        replacement: "Luat TNCN 109/2025",
        since: "2026-07-01",
    },
]

/** A regional minimum wage from a date. */
export interface MinimumWage {
    /** From when, YYYY-MM-DD. */
    readonly from: string
    /** The region. */
    readonly region: string
    /** The monthly minimum in VND. */
    readonly amount: number
}

/** The minimum wages of the pack, newest last. */
export const MINIMUM_WAGES: ReadonlyArray<MinimumWage> = [{ from: "2026-01-01", region: "III", amount: 4_140_000 }]

/** The minimum wage in force on a date, or null before the first one the pack knows. */
export const minimumWageOn = (date: string): MinimumWage | null =>
    MINIMUM_WAGES.findLast((wage) => wage.from <= date) ?? null
