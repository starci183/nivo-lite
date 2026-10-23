import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import {
    buildReceipt,
    canonicalJson,
    cleanupModeOf,
    countsOf,
    digestMatches,
    keptWorkspacesOf,
    maskEmail,
    nonZero,
    orphanAccountsOf,
    parseKeepList,
    receiptDigestOf,
} from "./workspace-cleanup.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("workspace-cleanup.policy")
const HAKUEN = "cd312306-c950-4328-8b88-022553070ae6"
const SPA = "11111111-1111-4111-8111-111111111111"
const BUN = "00000000-0000-4000-8000-000000000000"
const DIGEST = "a".repeat(64)
/** A letter past ASCII, which a plain sort puts after every ASCII key and a locale compare does not. */
const ACUTE_E = String.fromCodePoint(0xe9)

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    buildReceipt,
                    canonicalJson,
                    cleanupModeOf,
                    countsOf,
                    digestMatches,
                    keptWorkspacesOf,
                    maskEmail,
                    nonZero,
                    orphanAccountsOf,
                    parseKeepList,
                    receiptDigestOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./workspace-cleanup.policy")>(SUBJECT)
}

const refusedWith = (code: WorkspaceCleanupErrorCode) => objectLike({ code })

describe("workspace cleanup keep list", () => {
    it("reads the keep list as unique lower-case ids, sorted", async () => {
        const subject = await build()

        expect(subject.parseKeepList(` ${SPA.toUpperCase()}, ${HAKUEN},,${SPA} `)).toEqual([SPA, HAKUEN])
    })

    it.each([undefined, "", " , "])("refuses an empty keep list (%p)", async (raw) => {
        const subject = await build()

        expect(thrownBy(() => subject.parseKeepList(raw))).toEqual(refusedWith(WorkspaceCleanupErrorCode.KeepRequired))
    })

    it("refuses a keep id that is not a workspace id, and a list over the bound", async () => {
        const subject = await build()
        const many = Array.from({ length: 21 }, (_, index) => `${String(index).padStart(8, "0")}${SPA.slice(8)}`)

        expect(thrownBy(() => subject.parseKeepList("hakuen"))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepInvalid),
        )
        expect(thrownBy(() => subject.parseKeepList(many.join(",")))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepInvalid),
        )
    })
})

describe("workspace cleanup mode and digest", () => {
    it("answers the mode: a dry run, or an execute that names a digest", async () => {
        const subject = await build()

        expect(subject.cleanupModeOf({ dryRun: true })).toBe("dry-run")
        expect(subject.cleanupModeOf({ execute: true, receiptDigest: ` ${DIGEST.toUpperCase()} ` })).toBe("execute")
    })

    it("refuses no mode, both modes, and an execute without a well-formed digest", async () => {
        const subject = await build()

        expect(thrownBy(() => subject.cleanupModeOf({}))).toEqual(refusedWith(WorkspaceCleanupErrorCode.ModeRequired))
        expect(thrownBy(() => subject.cleanupModeOf({ dryRun: true, execute: true }))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.ModeRequired),
        )
        expect(thrownBy(() => subject.cleanupModeOf({ execute: true }))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.DigestRequired),
        )
        expect(thrownBy(() => subject.cleanupModeOf({ execute: true, receiptDigest: "abc" }))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.DigestRequired),
        )
    })

    it("matches a digest whatever its case and spaces, and nothing else", async () => {
        const subject = await build()

        expect(subject.digestMatches(DIGEST, ` ${DIGEST.toUpperCase()}`)).toBe(true)
        expect(subject.digestMatches(DIGEST, "b".repeat(64))).toBe(false)
        expect(subject.digestMatches(DIGEST, undefined)).toBe(false)
    })

    it("writes canonical JSON with sorted keys at every depth", async () => {
        const subject = await build()

        expect(subject.canonicalJson({ b: [{ d: 1, c: null }], a: "x" })).toBe('{"a":"x","b":[{"c":null,"d":1}]}')
    })

    it("keeps the code unit key order of a plain sort, so a receipt digest never changes with the host locale", async () => {
        const subject = await build()
        const keys = ["b", "B", "_a", "a.b", "a_b", ACUTE_E, "Z", "10", "9"]
        const value = Object.fromEntries(keys.map((key, index) => [key, index]))

        expect(subject.canonicalJson(value)).toBe(
            `{"10":7,"9":8,"B":1,"Z":6,"_a":2,"a.b":3,"a_b":4,"b":0,"${ACUTE_E}":5}`,
        )
    })

    it("masks an email to its first letter and domain, and answers null for none", async () => {
        const subject = await build()

        expect(subject.maskEmail("Hakuen.Demo@Gmail.com")).toBe("H***@gmail.com")
        expect(subject.maskEmail(undefined)).toBeNull()
        expect(subject.maskEmail("@nobody")).toBeNull()
        expect(subject.maskEmail("phone-only")).toBeNull()
    })
})

describe("workspace cleanup counts and accounts", () => {
    it("reads row counts by name, and keeps only those above zero", async () => {
        const subject = await build()

        expect(subject.countsOf({ leads: 2, agents: 0 }, WorkspaceCleanupErrorCode.FootprintInvalid)).toEqual({
            leads: 2,
            agents: 0,
        })
        expect(subject.nonZero({ leads: 2, agents: 0 })).toEqual({ leads: 2 })
    })

    it.each([null, [1], { leads: -1 }, { leads: 1.5 }, { leads: "3" }])(
        "refuses what is not row counts (%p) with the code it is given",
        async (raw) => {
            const subject = await build()

            expect(thrownBy(() => subject.countsOf(raw, WorkspaceCleanupErrorCode.ReferencesInvalid))).toEqual(
                refusedWith(WorkspaceCleanupErrorCode.ReferencesInvalid),
            )
        },
    )

    it("answers the kept workspaces by id, and refuses a keep id that is not in the database", async () => {
        const subject = await build()
        const spa = { id: SPA, name: "Spa", footprint: {} }
        const rows = [spa, { id: HAKUEN, name: "HAKUEN", footprint: null }, { id: BUN, name: "Bun", footprint: null }]

        expect(subject.keptWorkspacesOf([BUN, HAKUEN], rows)).toEqual([
            { id: BUN, name: "Bun" },
            { id: HAKUEN, name: "HAKUEN" },
        ])
        expect(thrownBy(() => subject.keptWorkspacesOf([HAKUEN], [spa]))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepNotFound),
        )
    })

    it("answers the accounts no kept workspace holds, by id", async () => {
        const subject = await build()

        expect(subject.orphanAccountsOf([{ id: "u-2" }, { id: "u-1" }, { id: "u-0" }], new Set(["u-1"]))).toEqual([
            { id: "u-0" },
            { id: "u-2" },
        ])
    })
})

describe("workspace cleanup receipt", () => {
    const none = { cascade: { "app_commands.requested_by": 0 }, block: {} }

    it("builds the receipt sorted by id, with the footprint of each removed workspace and the orphan accounts", async () => {
        const subject = await build()

        const receipt = subject.buildReceipt({
            keep: [HAKUEN],
            workspaces: [
                { id: SPA, name: "Spa", footprint: { leads: 3, agents: 1 } },
                { id: HAKUEN, name: "HAKUEN", footprint: null },
                { id: BUN, name: "Bun", footprint: {} },
            ],
            orphans: [{ id: "u-0" }, { id: "u-2", email: "spa@example.test" }],
            references: new Map([
                ["u-0", none],
                ["u-2", { cascade: { "app_commands.requested_by": 2 }, block: {} }],
            ]),
            allowKeptCascade: true,
        })

        expect(receipt).toEqual({
            schema: "nivo/workspace-cleanup-receipt@1",
            keep: [{ id: HAKUEN, name: "HAKUEN" }],
            remove: [
                { id: BUN, name: "Bun", rows: {}, total: 0 },
                { id: SPA, name: "Spa", rows: { leads: 3, agents: 1 }, total: 4 },
            ],
            orphanUsers: [
                { id: "u-0", email: null, keptCascade: {} },
                { id: "u-2", email: "s***@example.test", keptCascade: { "app_commands.requested_by": 2 } },
            ],
            uncounted: ["job_outbox"],
            allowKeptCascade: true,
        })
        expect(subject.receiptDigestOf(receipt)).toBe(
            createHash("sha256").update(subject.canonicalJson(receipt)).digest("hex"),
        )
        // the digest the plain-sort canonical JSON gave before the explicit comparator; an order change would move it
        expect(subject.receiptDigestOf(receipt)).toBe(
            "e9dc58f8f6268936bdf0dc4476d51ea2494815d978854b2431bcfe493aeb6d15",
        )
    })

    it("binds the kept cascade flag into the digest", async () => {
        const subject = await build()
        const facts = {
            keep: [HAKUEN],
            workspaces: [{ id: HAKUEN, name: "HAKUEN", footprint: null }],
            orphans: [],
            references: new Map(),
        }

        expect(subject.receiptDigestOf(subject.buildReceipt({ ...facts, allowKeptCascade: false }))).not.toBe(
            subject.receiptDigestOf(subject.buildReceipt({ ...facts, allowKeptCascade: true })),
        )
    })
})

describe("workspace cleanup receipt refusals", () => {
    it("refuses an orphan account whose references were not read", async () => {
        const subject = await build()

        expect(
            thrownBy(() =>
                subject.buildReceipt({
                    keep: [HAKUEN],
                    workspaces: [{ id: HAKUEN, name: "HAKUEN", footprint: null }],
                    orphans: [{ id: "u-0" }],
                    references: new Map(),
                    allowKeptCascade: false,
                }),
            ),
        ).toEqual(refusedWith(WorkspaceCleanupErrorCode.ReferencesInvalid))
    })

    it("refuses a footprint that is not row counts", async () => {
        const subject = await build()

        expect(
            thrownBy(() =>
                subject.buildReceipt({
                    keep: [HAKUEN],
                    workspaces: [
                        { id: HAKUEN, name: "HAKUEN", footprint: null },
                        { id: SPA, name: "Spa", footprint: null },
                    ],
                    orphans: [],
                    references: new Map(),
                    allowKeptCascade: false,
                }),
            ),
        ).toEqual(refusedWith(WorkspaceCleanupErrorCode.FootprintInvalid))
    })
})
