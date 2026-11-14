import { mock } from "@starci/jest-preset"
import { WorkbenchDoorService } from "@modules/domain/workbench-door"
import type { DoorAnswer, DoorFileCall } from "@modules/domain/workbench-door"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { WorkbenchFileConfirmCommand } from "./application/workbench-file-confirm.command"
import { WorkbenchFileConfirmHandler } from "./application/workbench-file-confirm.handler"
import { WorkbenchFileDeleteCommand } from "./application/workbench-file-delete.command"
import { WorkbenchFileDeleteHandler } from "./application/workbench-file-delete.handler"
import { WorkbenchFileLinkCommand } from "./application/workbench-file-link.command"
import { WorkbenchFileLinkHandler } from "./application/workbench-file-link.handler"
import { WorkbenchFileUploadCommand } from "./application/workbench-file-upload.command"
import { WorkbenchFileUploadHandler } from "./application/workbench-file-upload.handler"
import { WorkbenchFileUrlHandler } from "./application/workbench-file-url.handler"
import { WorkbenchFileUrlQuery } from "./application/workbench-file-url.query"
import {
    toWorkbenchActionRequest,
    toWorkbenchFileConfirmRequest,
    toWorkbenchFileDeleteRequest,
    toWorkbenchFileLinkRequest,
    toWorkbenchFileUploadRequest,
    toWorkbenchFileUrlRequest,
} from "./transport/graphql/workbench.mapper"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const RECORD = "0b9f1c2e-6d1a-4f0e-9a37-000000000001"
const PRINCIPAL: Principal = { id: "user-1", role: "authenticated" }
const ANSWER: DoorAnswer = { data: "{}" }

const TARGET = { via: "fixture.project-save", type: "fixture.project", recordId: RECORD, field: "cover" }
const CALL: DoorFileCall = { workspaceId: WORKSPACE, ...TARGET }

describe("the five file operations of the workbench door feature", () => {
    it("maps each input to one door call in the selected workspace, never one the input names", () => {
        expect(toWorkbenchFileUploadRequest(WORKSPACE, { ...TARGET, name: "a.png", mime: "image/png", size: 4 })).toEqual({
            call: CALL,
            facts: { name: "a.png", mime: "image/png", size: 4 },
        })
        expect(toWorkbenchFileConfirmRequest(WORKSPACE, { ...TARGET, key: "k", name: "a.png" })).toEqual({
            call: CALL,
            key: "k",
            name: "a.png",
        })
        expect(toWorkbenchFileLinkRequest(WORKSPACE, { ...TARGET, key: "k", name: "a.png" })).toEqual({
            call: CALL,
            key: "k",
            name: "a.png",
        })
        expect(toWorkbenchFileUrlRequest(WORKSPACE, TARGET)).toEqual({ call: CALL })
        expect(toWorkbenchFileDeleteRequest(WORKSPACE, TARGET)).toEqual({ call: CALL })
    })

    it("carries the installation an action is opened for, and nothing when the screen names none", () => {
        const installationId = "22222222-2222-4222-8222-222222222222"
        const input = { name: "sales.move-stage", input: "{}" }

        expect(toWorkbenchActionRequest(WORKSPACE, { ...input, installationId }, "vi")).toEqual({
            workspaceId: WORKSPACE,
            name: input.name,
            payload: "{}",
            locale: "vi",
            installationId,
        })
        expect(toWorkbenchActionRequest(WORKSPACE, input, "vi")).toEqual({
            workspaceId: WORKSPACE,
            name: input.name,
            payload: "{}",
            locale: "vi",
        })
    })

    it("carries the object key of one file of a list field in the url and delete calls, and only there", () => {
        const keyed = { ...TARGET, key: "ws/fixture.project/r/photos/o1" }

        expect(toWorkbenchFileUrlRequest(WORKSPACE, keyed)).toEqual({ call: { ...CALL, key: keyed.key } })
        expect(toWorkbenchFileDeleteRequest(WORKSPACE, keyed)).toEqual({ call: { ...CALL, key: keyed.key } })
    })

    it("hands each operation to exactly one method of the door, as the caller", async () => {
        const door = mock<WorkbenchDoorService>()
        door.fileUpload.mockResolvedValue(ANSWER)
        door.fileConfirm.mockResolvedValue(ANSWER)
        door.fileLink.mockResolvedValue(ANSWER)
        door.fileUrl.mockResolvedValue(ANSWER)
        door.fileDelete.mockResolvedValue(ANSWER)
        const logger = mock<Logger>()
        const facts = { name: "a.png", mime: "image/png", size: 4 }

        await new WorkbenchFileUploadHandler(logger, door).execute(
            new WorkbenchFileUploadCommand({ request: { call: CALL, facts }, principal: PRINCIPAL }),
        )
        await new WorkbenchFileConfirmHandler(logger, door).execute(
            new WorkbenchFileConfirmCommand({ request: { call: CALL, key: "k", name: "a.png" }, principal: PRINCIPAL }),
        )
        await new WorkbenchFileLinkHandler(logger, door).execute(
            new WorkbenchFileLinkCommand({ request: { call: CALL, key: "k", name: "a.png" }, principal: PRINCIPAL }),
        )
        await new WorkbenchFileUrlHandler(logger, door).execute(
            new WorkbenchFileUrlQuery({ request: { call: CALL }, principal: PRINCIPAL }),
        )
        await new WorkbenchFileDeleteHandler(logger, door).execute(
            new WorkbenchFileDeleteCommand({ request: { call: CALL }, principal: PRINCIPAL }),
        )

        expect(door.fileUpload).toHaveBeenCalledWith("user-1", CALL, facts)
        expect(door.fileConfirm).toHaveBeenCalledWith("user-1", CALL, "k", "a.png")
        expect(door.fileLink).toHaveBeenCalledWith("user-1", CALL, "k", "a.png")
        expect(door.fileUrl).toHaveBeenCalledWith("user-1", CALL)
        expect(door.fileDelete).toHaveBeenCalledWith("user-1", CALL)
    })
})
