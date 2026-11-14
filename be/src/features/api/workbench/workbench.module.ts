import { Module } from "@nestjs/common"
import { RecordTypesPageService } from "@modules/domain/workbench-door"
import { WorkbenchActionHandler } from "./application/workbench-action.handler"
import { WorkbenchFileConfirmHandler } from "./application/workbench-file-confirm.handler"
import { WorkbenchFileDeleteHandler } from "./application/workbench-file-delete.handler"
import { WorkbenchFileLinkHandler } from "./application/workbench-file-link.handler"
import { WorkbenchFileUploadHandler } from "./application/workbench-file-upload.handler"
import { WorkbenchFileUrlHandler } from "./application/workbench-file-url.handler"
import { WorkbenchReadHandler } from "./application/workbench-read.handler"
import { RecordTypesHandler } from "./application/record-types.handler"
import { ConfigurableModuleClass } from "./workbench.module-definition"

@Module({
    providers: [
        WorkbenchReadHandler,
        WorkbenchActionHandler,
        WorkbenchFileUploadHandler,
        WorkbenchFileConfirmHandler,
        WorkbenchFileLinkHandler,
        WorkbenchFileUrlHandler,
        WorkbenchFileDeleteHandler,
        RecordTypesPageService,
        RecordTypesHandler,
    ],
})
/** The application queries and commands of the workbench door feature: reads, actions and the files of records. */
export class WorkbenchApiModule extends ConfigurableModuleClass {}
