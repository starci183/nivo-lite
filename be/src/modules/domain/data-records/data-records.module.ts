import { Module, type DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./data-records.module-definition"
import { DataReadCursorsService } from "./data-read-cursors.service"
import { DataRecordsReadService } from "./data-records-read.service"
import { DataRecordsService } from "./data-records.service"

@Module({})
/**
 * The rows the owner's own systems put in the hub, over the primary PostgreSQL connection: the only writer of public.data_records. The
 * mails of a mailbox and how far each agent read them are the IMAP account's own data (`imap.mail`, `imap.read-cursor`).
 */
export class DataRecordsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), DataRecordsService, DataRecordsReadService, DataReadCursorsService],
            exports: [DataRecordsService, DataRecordsReadService, DataReadCursorsService],
        }
    }
}
