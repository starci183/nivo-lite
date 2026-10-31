import { factSlugOf } from "@modules/domain/brain-facts"
import type { FindingSeverity, RemedyAction } from "./dossier-review.contracts"
import type { DossierRef, EventKey, Expectation, PackEntry, PackRequirement, RoleKey } from "./dossier-inputs.contracts"
import { DOSSIER_PACK_WORDS } from "./messages/dossier-pack.messages"

type WordsKey<T> = keyof T & string

const isKeyOf = <T extends object>(table: T, key: string): key is WordsKey<T> => Object.hasOwn(table, key)

const basisOf = (ref: string): ReadonlyArray<string> =>
    isKeyOf(DOSSIER_PACK_WORDS.basis, ref) ? DOSSIER_PACK_WORDS.basis[ref] : []

/** The key of an expectation the words name. */
type ExpectationKey = keyof typeof DOSSIER_PACK_WORDS.labels

const remedyOf = (ref: string, action: RemedyAction): PackEntry["remedy"] => {
    if (!isKeyOf(DOSSIER_PACK_WORDS.remedies, ref)) return null
    const words = DOSSIER_PACK_WORDS.remedies[ref]
    return { documentType: words.documentType, guidance: words.guidance, action }
}

/** One expectation: folded words of a title or a passage, the role whose holder it must name, whether it must be signed. */
const expect = (
    key: ExpectationKey,
    words: ReadonlyArray<string>,
    severity: FindingSeverity,
    options: { readonly signed?: boolean; readonly about?: RoleKey; readonly textAny?: ReadonlyArray<string> } = {},
): Expectation => ({
    key,
    label: DOSSIER_PACK_WORDS.labels[key],
    titleAny: words,
    textAny: options.textAny ?? words,
    about: options.about ?? null,
    signed: options.signed ?? false,
    severity,
})

interface EntryShape {
    readonly hint: string
    readonly requirement: PackRequirement
    readonly related?: ReadonlyArray<string>
    readonly expects?: ReadonlyArray<Expectation>
    readonly mustReflect?: ReadonlyArray<EventKey>
    readonly tracksExpiry?: boolean
    readonly action?: RemedyAction
}

const R = "required"
const C = "conditional"
const O = "optional"
const T = "template"

/** The 64 dossiers of the standard set of a Vietnamese multi-member LLC plus the supervisory board, by reference. */
const SHAPES: ReadonlyArray<readonly [string, EntryShape]> = [
    [
        "1",
        {
            hint: "giay-chung-nhan",
            requirement: R,
            related: ["2", "6", "9", "50"],
            action: "external",
            expects: [
                expect(
                    "registration_certificate",
                    ["giay chung nhan dang ky doanh nghiep", "gcn dkdn", "gpkd", "dang ky doanh nghiep"],
                    "high",
                ),
                expect(
                    "change_dossier",
                    ["ho so dang ky thay doi", "thong bao thay doi", "giay de nghi dang ky thay doi"],
                    "low",
                ),
            ],
        },
    ],
    [
        "2",
        {
            hint: "dieu-le",
            requirement: R,
            related: ["1", "8", "10", "11", "12", "19", "20", "45"],
            action: "draft",
            mustReflect: ["capital_transfer", "member_change"],
            expects: [expect("charter", ["dieu le"], "high", { signed: true })],
        },
    ],
    [
        "3",
        {
            hint: "con-dau",
            requirement: R,
            action: "draft",
            expects: [
                expect("seal_decision", ["con dau"], "medium", {
                    signed: true,
                    textAny: ["quan ly va su dung con dau"],
                }),
            ],
        },
    ],
    [
        "4",
        {
            hint: "chu-ky-so",
            requirement: O,
            tracksExpiry: true,
            expects: [expect("certificate_register", ["chu ky so", "chung thu"], "low")],
        },
    ],
    [
        "5",
        {
            hint: "tai-khoan-ngan-hang",
            requirement: C,
            related: ["23", "42"],
            action: "external",
            mustReflect: ["role_change"],
            expects: [
                expect("bank_accounts", ["tai khoan ngan hang", "tai khoan"], "medium", { textAny: ["ngan hang"] }),
            ],
        },
    ],
    [
        "6",
        {
            hint: "nguoi-dai-dien",
            requirement: R,
            related: ["1", "23"],
            action: "upload",
            mustReflect: ["legal_rep_change"],
            expects: [
                expect("legal_representative_id", ["cccd", "can cuoc", "cmnd"], "medium", {
                    about: "legal_representative",
                }),
            ],
        },
    ],
    ["7", { hint: "cong-van", requirement: O }],
    [
        "8",
        {
            hint: "so-dang-ky-thanh-vien",
            requirement: R,
            related: ["2", "9", "10", "11", "12"],
            action: "draft",
            mustReflect: ["capital_transfer", "member_change"],
            expects: [expect("members_register", ["so dang ky thanh vien"], "high", { signed: true })],
        },
    ],
    ["9", { hint: "danh-sach-thanh-vien", requirement: C, related: ["1", "8"] }],
    [
        "10",
        {
            hint: "bien-ban-gop-von",
            requirement: R,
            related: ["2", "8", "11", "12", "45"],
            action: "draft",
            mustReflect: ["capital_transfer"],
            expects: [expect("contribution_minutes", ["bien ban gop von"], "high", { signed: true })],
        },
    ],
    [
        "11",
        {
            hint: "chung-tu-gop-von",
            requirement: R,
            related: ["2", "10", "45"],
            action: "upload",
            mustReflect: ["capital_transfer"],
            expects: [expect("contribution_vouchers", ["chung tu gop von", "sao ke", "bien nhan"], "high")],
        },
    ],
    [
        "12",
        {
            hint: "phan-von-gop",
            requirement: R,
            related: ["2", "8", "10"],
            action: "draft",
            mustReflect: ["capital_transfer"],
            expects: [
                expect("capital_certificates", ["giay chung nhan phan von gop", "chung nhan phan von gop"], "high", {
                    signed: true,
                }),
            ],
        },
    ],
    ["13", { hint: "thoa-thuan-thanh-vien", requirement: O }],
    ["14", { hint: "moi-hop", requirement: C }],
    ["15", { hint: "chuong-trinh", requirement: C }],
    ["16", { hint: "du-hop", requirement: O }],
    ["17", { hint: "uy-quyen-du-hop", requirement: O }],
    ["18", { hint: "phieu", requirement: C }],
    [
        "19",
        {
            hint: "bien-ban-hop",
            requirement: R,
            related: ["20", "21", "23"],
            action: "draft",
            mustReflect: ["capital_transfer", "legal_rep_change"],
            expects: [expect("council_minutes", ["bien ban hop"], "high", { signed: true })],
        },
    ],
    [
        "20",
        {
            hint: "nghi-quyet",
            requirement: R,
            related: ["2", "19", "21"],
            action: "draft",
            mustReflect: ["capital_transfer", "legal_rep_change"],
            expects: [expect("council_resolutions", ["nghi quyet"], "high", { signed: true })],
        },
    ],
    [
        "21",
        {
            hint: "bau-chu-tich",
            requirement: R,
            related: ["19", "20"],
            action: "draft",
            expects: [expect("chair_election", ["bau chu tich"], "high", { signed: true })],
        },
    ],
    ["22", { hint: "chu-tich", requirement: C }],
    ["BKS", { hint: "kiem-soat", requirement: O }],
    [
        "23",
        {
            hint: "bo-nhiem",
            requirement: R,
            related: ["5", "6", "29"],
            action: "draft",
            mustReflect: ["role_change"],
            expects: [expect("appointments", ["quyet dinh bo nhiem"], "high", { signed: true })],
        },
    ],
    ["24", { hint: "noi-quy", requirement: O }],
    ["25", { hint: "luong", requirement: R, related: ["28"] }],
    ["26", { hint: "thuong", requirement: O }],
    ["27", { hint: "kpi", requirement: O }],
    [
        "28",
        {
            hint: "hop-dong-lao-dong",
            requirement: R,
            related: ["25", "29"],
            expects: [expect("labour_contracts", ["hop dong lao dong", "hdld"], "medium")],
        },
    ],
    [
        "29",
        {
            hint: "nhan-su",
            requirement: R,
            related: ["23", "28"],
            action: "upload",
            mustReflect: ["role_change"],
            expects: [expect("staff_ids", ["cccd", "can cuoc"], "medium", { about: "employee" })],
        },
    ],
    ["30", { hint: "bhxh", requirement: R }],
    ["31", { hint: "phan-quyen", requirement: O }],
    ["32", { hint: "tham-quyen", requirement: O }],
    ["33", { hint: "han-muc", requirement: O }],
    ["34", { hint: "uy-quyen", requirement: C }],
    ["35", { hint: "mua-vao", requirement: C }],
    ["36", { hint: "phan-mem", requirement: C }],
    [
        "37",
        {
            hint: "bao-mat",
            requirement: O,
            related: ["28"],
            action: "draft",
            expects: [expect("nda", ["thoa thuan bao mat", "nda"], "medium", { signed: true })],
        },
    ],
    ["38", { hint: "du-lieu-ca-nhan", requirement: C }],
    ["39", { hint: "phu-luc", requirement: C }],
    ["40", { hint: "nghiem-thu", requirement: C }],
    ["41", { hint: "theo-doi-hop-dong", requirement: O }],
    ["42", { hint: "quy-che-tai-chinh", requirement: O }],
    ["43", { hint: "ngan-sach", requirement: O }],
    ["44", { hint: "chung-tu-ke-toan", requirement: R }],
    ["45", { hint: "so-sach-ke-toan", requirement: R, related: ["10", "11", "44"] }],
    ["46", { hint: "bao-cao-tai-chinh", requirement: R }],
    ["47", { hint: "thue", requirement: R }],
    ["48", { hint: "nguoi-co-lien-quan", requirement: O }],
    ["49", { hint: "loi-ich", requirement: O }],
    ["50", { hint: "chu-so-huu-huong-loi", requirement: R, related: ["8", "9"] }],
    ["51", { hint: "xac-dinh-chu-so-huu", requirement: O }],
    ["52", { hint: "nhan-hieu", requirement: O }],
    [
        "53",
        {
            hint: "ten-mien",
            requirement: C,
            related: ["29"],
            tracksExpiry: true,
            expects: [expect("domain_register", ["ten mien"], "low")],
        },
    ],
    ["54", { hint: "quyen-tac-gia", requirement: O }],
    ["55", { hint: "quyen-rieng-tu", requirement: C }],
    ["56", { hint: "bao-ve-du-lieu", requirement: R }],
    ["57", { hint: "danh-gia-tac-dong", requirement: R }],
    ["58", { hint: "mau-quyet-dinh", requirement: T }],
    ["59", { hint: "mau-nghi-quyet", requirement: T }],
    ["60", { hint: "mau-bien-ban", requirement: T }],
    ["61", { hint: "mau-giay-uy-quyen", requirement: T }],
    ["62", { hint: "mau-hop-dong", requirement: T }],
    ["63", { hint: "thanh-toan", requirement: T }],
    ["64", { hint: "checklist", requirement: T }],
]

const entryOf = ([ref, shape]: readonly [string, EntryShape]): PackEntry => ({
    ref,
    nameHint: [shape.hint],
    requirement: shape.requirement,
    basis: basisOf(ref),
    expects: shape.expects ?? [],
    mustReflect: shape.mustReflect ?? [],
    tracksExpiry: shape.tracksExpiry ?? false,
    related: shape.related ?? [],
    remedy: remedyOf(ref, shape.action ?? "upload"),
})

/** The pack vn-llc-64@1 by reference. */
export const PACK: ReadonlyMap<string, PackEntry> = new Map(SHAPES.map((shape) => [shape[0], entryOf(shape)]))

/** The pack entry of a workspace dossier: the entry of its reference, only when its name carries the entry's hint (a renumbered checklist gets the generic rules only). */
export const packEntryOf = (dossier: Pick<DossierRef, "ref" | "name">): PackEntry | null => {
    const entry = PACK.get(dossier.ref)
    if (entry === undefined) return null
    const name = factSlugOf(dossier.name)
    return entry.nameHint.some((hint) => name.includes(hint)) ? entry : null
}
