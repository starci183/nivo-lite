import { Module } from "@nestjs/common"
import { RequestDataSyncHandler } from "./application/request-data-sync.handler"
import { SetSyncScheduleHandler } from "./application/set-sync-schedule.handler"
import { DataSyncRunHandler } from "./application/data-sync-run.handler"
import { PreviewCsvSourceHandler } from "./application/preview-csv-source.handler"
import { LoadCsvImportHandler } from "./application/load-csv-import.handler"
import { RunCsvImportHandler } from "./application/run-csv-import.handler"
import { RunDocumentImportHandler } from "./application/run-document-import.handler"
import { TestDatabaseHandler } from "./application/test-database.handler"
import { PreviewDatabaseTableHandler } from "./application/preview-database-table.handler"
import { SaveDatabaseConnectionHandler } from "./application/save-database-connection.handler"
import { LoadDatabaseConnectionHandler } from "./application/load-database-connection.handler"
import { TestImapConnectionHandler } from "./application/test-imap-connection.handler"
import { SaveImapConnectionHandler } from "./application/save-imap-connection.handler"
import { LoadImapConnectionHandler } from "./application/load-imap-connection.handler"
import { LoadOpenApiSpecHandler } from "./application/load-open-api-spec.handler"
import { TestOpenApiOperationHandler } from "./application/test-open-api-operation.handler"
import { LoadOpenApiConnectionHandler } from "./application/load-open-api-connection.handler"
import { SaveOpenApiConnectionHandler } from "./application/save-open-api-connection.handler"
import { TelegramUserReadyHandler } from "./application/telegram-user-ready.handler"
import { LoadTelegramUserSetupHandler } from "./application/load-telegram-user-setup.handler"
import { StartTelegramLoginHandler } from "./application/start-telegram-login.handler"
import { ResendTelegramCodeHandler } from "./application/resend-telegram-code.handler"
import { SubmitTelegramCodeHandler } from "./application/submit-telegram-code.handler"
import { SubmitTelegramPasswordHandler } from "./application/submit-telegram-password.handler"
import { CancelTelegramLoginHandler } from "./application/cancel-telegram-login.handler"
import { ListTelegramChatsHandler } from "./application/list-telegram-chats.handler"
import { SaveTelegramUserSetupHandler } from "./application/save-telegram-user-setup.handler"

@Module({
    providers: [
        RequestDataSyncHandler,
        SetSyncScheduleHandler,
        DataSyncRunHandler,
        PreviewCsvSourceHandler,
        LoadCsvImportHandler,
        RunCsvImportHandler,
        RunDocumentImportHandler,
        TestDatabaseHandler,
        PreviewDatabaseTableHandler,
        SaveDatabaseConnectionHandler,
        LoadDatabaseConnectionHandler,
        TestImapConnectionHandler,
        SaveImapConnectionHandler,
        LoadImapConnectionHandler,
        LoadOpenApiSpecHandler,
        TestOpenApiOperationHandler,
        LoadOpenApiConnectionHandler,
        SaveOpenApiConnectionHandler,
        TelegramUserReadyHandler,
        LoadTelegramUserSetupHandler,
        StartTelegramLoginHandler,
        ResendTelegramCodeHandler,
        SubmitTelegramCodeHandler,
        SubmitTelegramPasswordHandler,
        CancelTelegramLoginHandler,
        ListTelegramChatsHandler,
        SaveTelegramUserSetupHandler,
    ],
})
/** The data hub feature: the handlers of its application. */
export class DataHubApiModule {}
