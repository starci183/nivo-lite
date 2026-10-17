import { Module } from "@nestjs/common"
import { DataHubApiModule } from "../../data-hub.module"
import { ConfigurableModuleClass } from "./data-hub-graphql.module-definition"
import { RequestDataSyncResolver } from "./request-data-sync.resolver"
import { SetSyncScheduleResolver } from "./set-sync-schedule.resolver"
import { DataSyncRunResolver } from "./data-sync-run.resolver"
import { PreviewCsvSourceResolver } from "./preview-csv-source.resolver"
import { LoadCsvImportResolver } from "./load-csv-import.resolver"
import { RunCsvImportResolver } from "./run-csv-import.resolver"
import { RunDocumentImportResolver } from "./run-document-import.resolver"
import { TestDatabaseResolver } from "./test-database.resolver"
import { PreviewDatabaseTableResolver } from "./preview-database-table.resolver"
import { SaveDatabaseConnectionResolver } from "./save-database-connection.resolver"
import { LoadDatabaseConnectionResolver } from "./load-database-connection.resolver"
import { TestImapConnectionResolver } from "./test-imap-connection.resolver"
import { SaveImapConnectionResolver } from "./save-imap-connection.resolver"
import { LoadImapConnectionResolver } from "./load-imap-connection.resolver"
import { LoadOpenApiSpecResolver } from "./load-open-api-spec.resolver"
import { TestOpenApiOperationResolver } from "./test-open-api-operation.resolver"
import { LoadOpenApiConnectionResolver } from "./load-open-api-connection.resolver"
import { SaveOpenApiConnectionResolver } from "./save-open-api-connection.resolver"
import { TelegramUserReadyResolver } from "./telegram-user-ready.resolver"
import { LoadTelegramUserSetupResolver } from "./load-telegram-user-setup.resolver"
import { StartTelegramLoginResolver } from "./start-telegram-login.resolver"
import { ResendTelegramCodeResolver } from "./resend-telegram-code.resolver"
import { SubmitTelegramCodeResolver } from "./submit-telegram-code.resolver"
import { SubmitTelegramPasswordResolver } from "./submit-telegram-password.resolver"
import { CancelTelegramLoginResolver } from "./cancel-telegram-login.resolver"
import { ListTelegramChatsResolver } from "./list-telegram-chats.resolver"
import { SaveTelegramUserSetupResolver } from "./save-telegram-user-setup.resolver"

@Module({
    imports: [DataHubApiModule.register({})],
    providers: [
        RequestDataSyncResolver,
        SetSyncScheduleResolver,
        DataSyncRunResolver,
        PreviewCsvSourceResolver,
        LoadCsvImportResolver,
        RunCsvImportResolver,
        RunDocumentImportResolver,
        TestDatabaseResolver,
        PreviewDatabaseTableResolver,
        SaveDatabaseConnectionResolver,
        LoadDatabaseConnectionResolver,
        TestImapConnectionResolver,
        SaveImapConnectionResolver,
        LoadImapConnectionResolver,
        LoadOpenApiSpecResolver,
        TestOpenApiOperationResolver,
        LoadOpenApiConnectionResolver,
        SaveOpenApiConnectionResolver,
        TelegramUserReadyResolver,
        LoadTelegramUserSetupResolver,
        StartTelegramLoginResolver,
        ResendTelegramCodeResolver,
        SubmitTelegramCodeResolver,
        SubmitTelegramPasswordResolver,
        CancelTelegramLoginResolver,
        ListTelegramChatsResolver,
        SaveTelegramUserSetupResolver,
    ],
})
/** The GraphQL transport of the data hub feature. */
export class DataHubGraphqlModule extends ConfigurableModuleClass {}
