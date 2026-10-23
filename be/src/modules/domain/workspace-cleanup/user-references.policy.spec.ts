import { Test } from "@nestjs/testing"
import { WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import { assertUserReferences, userReferencesOf } from "./user-references.policy"
import type { UserReferences } from "./workspace-cleanup.contracts"

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

const SUBJECT = Symbol("user-references.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { assertUserReferences, userReferencesOf } }],
    }).compile()
    return moduleRef.get<typeof import("./user-references.policy")>(SUBJECT)
}

const refusedWith = (code: WorkspaceCleanupErrorCode, params?: Record<string, string>) =>
    objectLike(params === undefined ? { code } : { code, params })

const CLEAN: UserReferences = { cascade: { "app_commands.requested_by": 0 }, block: { "lead_actions.requested_by": 0 } }
const CASCADING: UserReferences = {
    cascade: { "hiring_availability.member_user_id": 1, "app_commands.requested_by": 4 },
    block: { "lead_actions.requested_by": 0 },
}
const BLOCKED: UserReferences = { cascade: {}, block: { "lead_actions.requested_by": 2 } }

describe("user references reading", () => {
    it("reads the cascade and block counts of each account", async () => {
        const subject = await build()

        const references = subject.userReferencesOf(
            ["u-1"],
            [{ user_id: "u-1", refs: { cascade: { "app_commands.requested_by": 3 }, block: {} } }],
        )

        expect(references.get("u-1")).toEqual({ cascade: { "app_commands.requested_by": 3 }, block: {} })
    })

    it.each([null, [], { cascade: {} }, { cascade: { a: -1 }, block: {} }])(
        "refuses a references row that is not counts (%p)",
        async (refs) => {
            const subject = await build()

            expect(thrownBy(() => subject.userReferencesOf(["u-1"], [{ user_id: "u-1", refs }]))).toEqual(
                refusedWith(WorkspaceCleanupErrorCode.ReferencesInvalid),
            )
        },
    )

    it("refuses when an account has no references row", async () => {
        const subject = await build()

        expect(thrownBy(() => subject.userReferencesOf(["u-1", "u-2"], [{ user_id: "u-1", refs: CLEAN }]))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.ReferencesInvalid),
        )
    })
})

describe("user references refusals", () => {
    it("passes accounts whose delete touches no kept row", async () => {
        const subject = await build()

        expect(() => subject.assertUserReferences(new Map([["u-1", CLEAN]]), false)).not.toThrow()
    })

    it("refuses a blocked delete, naming the users and the tables, even with the kept cascade allowed", async () => {
        const subject = await build()
        const references = new Map([
            ["u-2", BLOCKED],
            ["u-1", CLEAN],
            ["u-3", BLOCKED],
        ])

        expect(thrownBy(() => subject.assertUserReferences(references, true))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.UserReferenceBlocked, {
                users: "u-2,u-3",
                tables: "lead_actions.requested_by",
            }),
        )
    })

    it("refuses a kept cascade by default, naming the users and the tables", async () => {
        const subject = await build()

        expect(thrownBy(() => subject.assertUserReferences(new Map([["u-4", CASCADING]]), false))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeptCascadeRefused, {
                users: "u-4",
                tables: "app_commands.requested_by,hiring_availability.member_user_id",
            }),
        )
    })

    it("names the tables of every offender once, in alphabetical order", async () => {
        const subject = await build()
        const references = new Map<string, UserReferences>([
            ["u-5", { cascade: { "zeta.owner_id": 1, "Beta.owner_id": 1 }, block: {} }],
            ["u-6", { cascade: { "alpha.owner_id": 2, "zeta.owner_id": 3 }, block: {} }],
        ])

        expect(thrownBy(() => subject.assertUserReferences(references, false))).toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeptCascadeRefused, {
                users: "u-5,u-6",
                tables: "alpha.owner_id,Beta.owner_id,zeta.owner_id",
            }),
        )
    })

    it("passes a kept cascade when it is allowed", async () => {
        const subject = await build()

        expect(() => subject.assertUserReferences(new Map([["u-4", CASCADING]]), true)).not.toThrow()
    })
})
