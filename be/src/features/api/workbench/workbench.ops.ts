import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { RecordTypesPageService } from "@modules/domain/workbench-door"
import { RecordTypesHandler } from "./application/record-types.handler"
import { RecordTypesQuery } from "./application/record-types.query"
import { WorkbenchActionCommand } from "./application/workbench-action.command"
import { WorkbenchActionHandler } from "./application/workbench-action.handler"
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
import { WorkbenchReadHandler } from "./application/workbench-read.handler"
import { WorkbenchReadQuery } from "./application/workbench-read.query"

/** The workbench ops of the outbound MCP surface (reads, actions, record files, record types): the message each op sends to the door handlers, with those handlers. */
export const WORKBENCH_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [
        WorkbenchReadHandler,
        WorkbenchActionHandler,
        RecordTypesPageService,
        RecordTypesHandler,
        WorkbenchFileUploadHandler,
        WorkbenchFileConfirmHandler,
        WorkbenchFileLinkHandler,
        WorkbenchFileUrlHandler,
        WorkbenchFileDeleteHandler,
    ],
    queries: {
        [NIVO_API.file.get]: WorkbenchFileUrlQuery,
        [NIVO_API.workbench.read]: WorkbenchReadQuery,
        [NIVO_API.record.typeList]: RecordTypesQuery,
    },
    commands: {
        [NIVO_API.file.upload]: WorkbenchFileUploadCommand,
        [NIVO_API.file.confirm]: WorkbenchFileConfirmCommand,
        [NIVO_API.file.link]: WorkbenchFileLinkCommand,
        [NIVO_API.file.delete]: WorkbenchFileDeleteCommand,
        [NIVO_API.workbench.action]: WorkbenchActionCommand,
    },
}
