import { Test } from "@nestjs/testing"
import { noAccount as realNoAccount } from "./account-directory.policy"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"

const SUBJECT = Symbol("account-directory.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { noAccount: realNoAccount } }],
    }).compile()
    return moduleRef.get<{ noAccount: typeof realNoAccount }>(SUBJECT).noAccount
}

describe("account directory policy", () => {
    it("answers no account for any user when the app composes no account directory", async () => {
        const noAccount = await buildSubject()

        await expect(noAccount()).resolves.toEqual({
            kind: "refused",
            code: WorkspaceMembersErrorCode.MemberNotFound,
            params: undefined,
        })
    })
})
