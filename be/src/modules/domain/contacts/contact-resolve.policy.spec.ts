import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { IdentityMatch, NameMatch, NormalIdentity, TokenContact } from "./contacts.contracts"
import { mergeReasonOf as mergeReasonOfSubject, resolveContact as resolveContactSubject } from "./contact-resolve.policy"

const SUBJECT = Symbol("contact-resolve.policy")

const build = async (): Promise<{ mergeReasonOf: typeof mergeReasonOfSubject; resolveContact: typeof resolveContactSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ mergeReasonOf: typeof mergeReasonOfSubject; resolveContact: typeof resolveContactSubject }>({ mergeReasonOf: mergeReasonOfSubject, resolveContact: resolveContactSubject }) }],
    }).compile()
    return moduleRef.get<{ mergeReasonOf: typeof mergeReasonOfSubject; resolveContact: typeof resolveContactSubject }>(SUBJECT)
}

const WS = "ws-1"
const OTHER_WS = "ws-2"

const phone = (value: string, proof: NormalIdentity["proof"]): NormalIdentity => ({ kind: "phone", provider: "", account: "", value, proof })
const email = (value: string, proof: NormalIdentity["proof"]): NormalIdentity => ({ kind: "email", provider: "", account: "", value, proof })
const zalo = (value: string): NormalIdentity => ({ kind: "channel", provider: "zalo", account: "zalo-1", value, proof: "channel" })
const telegram = (value: string): NormalIdentity => ({ kind: "channel", provider: "telegram", account: "tg-1", value, proof: "channel" })

const held = (identity: NormalIdentity, contactId: string, verified: boolean, at = "2026-11-01T00:00:00.000Z", workspaceId = WS): IdentityMatch => ({
    key: { kind: identity.kind, provider: identity.provider, account: identity.account, value: identity.value },
    contactId,
    workspaceId,
    verified,
    contactCreatedAt: at,
})

interface Row {
    readonly name: string
    readonly incoming: ReadonlyArray<NormalIdentity>
    readonly matches: ReadonlyArray<IdentityMatch>
    readonly names?: ReadonlyArray<NameMatch>
    readonly token?: TokenContact
    readonly want: unknown
}

/** Every row of the owner's identity rules (contacts.md Rules 1-3), signal → result. */
const ROWS: ReadonlyArray<Row> = [
    {
        name: "a channel id another contact holds is that contact (the channel vouches for its own id)",
        incoming: [zalo("z-1")],
        matches: [held(zalo("z-1"), "A", true)],
        want: { outcome: "contact", contactId: "A", attach: [], merges: [], suggestions: [] },
    },
    {
        name: "exact VERIFIED phone held verified by another contact → merge into it",
        incoming: [telegram("t-9"), phone("84912345678", "token")],
        matches: [held(phone("84912345678", "token"), "A", true)],
        want: { outcome: "contact", contactId: "A", attach: [telegram("t-9")], merges: [], suggestions: [] },
    },
    {
        name: "exact VERIFIED mail held verified by another contact → merge into it",
        incoming: [email("lan@gmail.com", "member")],
        matches: [held(email("lan@gmail.com", "member"), "A", true)],
        want: { outcome: "contact", contactId: "A", attach: [], merges: [], suggestions: [] },
    },
    {
        name: "a channel id of B and a verified phone of A: one person, B merges into the older A for the phone",
        incoming: [telegram("t-9"), phone("84912345678", "token")],
        matches: [
            held(telegram("t-9"), "B", true, "2026-11-05T00:00:00.000Z"),
            held(phone("84912345678", "token"), "A", true, "2026-11-01T00:00:00.000Z"),
        ],
        want: { outcome: "contact", contactId: "A", attach: [], merges: [{ from: "B", reason: "phone_verified" }], suggestions: [] },
    },
    {
        name: "a valid link token's contact is the person: the contact presenting it merges into it",
        incoming: [telegram("t-9")],
        matches: [held(telegram("t-9"), "B", true, "2026-11-05T00:00:00.000Z")],
        token: { contactId: "A", workspaceId: WS, createdAt: "2026-11-01T00:00:00.000Z" },
        want: { outcome: "contact", contactId: "A", attach: [], merges: [{ from: "B", reason: "link_token" }], suggestions: [] },
    },
    {
        name: "a link token of another workspace proves nothing",
        incoming: [telegram("t-9")],
        matches: [],
        token: { contactId: "A", workspaceId: OTHER_WS, createdAt: "2026-11-01T00:00:00.000Z" },
        want: { outcome: "create", attach: [telegram("t-9")], suggestions: [] },
    },
    {
        name: "a SELF-DECLARED phone equal to another contact's verified phone → a proposal, NOT merged",
        incoming: [zalo("z-2"), phone("84912345678", null)],
        matches: [held(phone("84912345678", "token"), "A", true)],
        want: {
            outcome: "create",
            attach: [zalo("z-2"), phone("84912345678", null)],
            suggestions: [
                {
                    contactId: "A",
                    why: "claimed_identity",
                    identity: { kind: "phone", provider: "", account: "", value: "84912345678" },
                },
            ],
        },
    },
    {
        name: "a VERIFIED phone equal to a phone another contact only CLAIMED → no merge, a suggestion",
        incoming: [zalo("z-2"), phone("84912345678", "token")],
        matches: [held(phone("84912345678", null), "A", false)],
        want: {
            outcome: "create",
            attach: [zalo("z-2"), phone("84912345678", "token")],
            suggestions: [
                {
                    contactId: "A",
                    why: "claimed_identity",
                    identity: { kind: "phone", provider: "", account: "", value: "84912345678" },
                },
            ],
        },
    },
    {
        name: "the same name only → a suggestion, never a merge",
        incoming: [zalo("z-3")],
        matches: [],
        names: [{ contactId: "A", workspaceId: WS }],
        want: {
            outcome: "create",
            attach: [zalo("z-3")],
            suggestions: [{ contactId: "A", why: "same_name", identity: null }],
        },
    },
    {
        name: "different workspaces never meet: a match or a name of another workspace is ignored",
        incoming: [zalo("z-1"), phone("84912345678", "token")],
        matches: [held(zalo("z-1"), "X", true, undefined, OTHER_WS), held(phone("84912345678", "token"), "Y", true, undefined, OTHER_WS)],
        names: [{ contactId: "Z", workspaceId: OTHER_WS }],
        want: { outcome: "create", attach: [zalo("z-1"), phone("84912345678", "token")], suggestions: [] },
    },
    {
        name: "nobody holds anything → a new contact with every incoming identity",
        incoming: [zalo("z-4"), phone("84987654321", null)],
        matches: [],
        want: { outcome: "create", attach: [zalo("z-4"), phone("84987654321", null)], suggestions: [] },
    },
]

describe("contact-resolve.policy: the owner's identity rules, row by row", () => {
    let mergeReasonOf: typeof mergeReasonOfSubject
    let resolveContact: typeof resolveContactSubject

    beforeAll(async () => {
        ;({ mergeReasonOf, resolveContact } = await build())
    })

    it.each(ROWS.map((row) => [row.name, row] as const))("%s", (_name, row) => {
        expect(resolveContact(WS, { incoming: row.incoming, matches: row.matches, names: row.names ?? [], token: row.token ?? null })).toEqual(
            row.want,
        )
    })

    it("names a merge by the identity that proves it: a phone or a mail; nothing else proves two contacts are one", () => {
        expect(mergeReasonOf(phone("8491", "token"))).toBe("phone_verified")
        expect(mergeReasonOf(email("a@b.c", "channel"))).toBe("email_verified")
        expect(mergeReasonOf(zalo("z"))).toBeNull()
    })
})
