import { Test } from "@nestjs/testing"
import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { selectWorkspace as realSelectWorkspace } from "./workspace-selector.policy"

const WORKSPACE = "6f1b7a54-3c1e-4a53-9a55-0d6f8b1b2c3d"

const SUBJECT = Symbol("workspace-selector.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { selectWorkspace: realSelectWorkspace } }],
    }).compile()
    return moduleRef.get<typeof import("./workspace-selector.policy")>(SUBJECT)
}

describe("selectWorkspace", () => {
    it("reads one well-formed workspace id, whatever its case", async () => {
        const { selectWorkspace } = await buildSubject()

        expect(selectWorkspace(WORKSPACE)).toSucceedWith(WORKSPACE)
        expect(selectWorkspace(WORKSPACE.toUpperCase())).toSucceedWith(WORKSPACE.toUpperCase())
    })

    it.each([undefined, "", "not-a-uuid", [WORKSPACE]])(
        "refuses a header that names no usable workspace (%s)",
        async (header) => {
            const { selectWorkspace } = await buildSubject()

            expect(selectWorkspace(header)).toBeRefused(WorkspaceMembersErrorCode.WorkspaceRequired)
        },
    )
})
