import { WorkspaceMembersErrorCode } from "./errors/workspace-members.error"
import { selectWorkspace } from "./workspace-selector.policy"

const WORKSPACE = "6f1b7a54-3c1e-4a53-9a55-0d6f8b1b2c3d"

describe("selectWorkspace", () => {
    it("reads one well-formed workspace id, whatever its case", () => {
        expect(selectWorkspace(WORKSPACE)).toSucceedWith(WORKSPACE)
        expect(selectWorkspace(WORKSPACE.toUpperCase())).toSucceedWith(WORKSPACE.toUpperCase())
    })

    it.each([undefined, "", "not-a-uuid", [WORKSPACE]])(
        "refuses a header that names no usable workspace (%s)",
        (header) => {
            expect(selectWorkspace(header)).toBeRefused(WorkspaceMembersErrorCode.WorkspaceRequired)
        },
    )
})
