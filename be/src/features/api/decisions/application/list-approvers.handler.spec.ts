import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ApproverDirectoryService } from "@modules/domain/agent-pages"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ListApproversHandler } from "./list-approvers.handler"
import { ListApproversQuery } from "./list-approvers.query"

const build = async () => {
    const directory = mock<ApproverDirectoryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ListApproversHandler,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: ApproverDirectoryService, useValue: directory },
        ],
    }).compile()
    return { handler: moduleRef.get(ListApproversHandler), directory }
}

describe("ListApproversHandler", () => {
    it("asks the approver directory as the signed-in person for the named workspace and answers what it answers", async () => {
        const { handler, directory } = await build()
        directory.list.mockResolvedValue([])
        const principal = { id: "user-1", role: "authenticated" as const }

        await expect(handler.execute(new ListApproversQuery({ request: { workspaceId: "ws-1" }, principal }))).resolves.toEqual([])
        expect(directory.list).toHaveBeenCalledWith("user-1", "ws-1")
    })
})
