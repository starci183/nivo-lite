import { Module, type DynamicModule } from "@nestjs/common"
import { RECORD_FILES_STORAGE } from "./record-files.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./record-files.module-definition"
import { RecordFilesService } from "./record-files.service"
import { RecordFileFetchService } from "./record-files-fetch.service"
import { CONTACT_RECORDS } from "@modules/domain/contacts"
import { RecordContactErasureService } from "./record-contact-erasure.service"
import { AGENT_RECORDS } from "@modules/domain/modules"
import { RecordAgentErasureService } from "./record-agent-erasure.service"

@Module({})
/** The one generic file store of the records: upload tickets, confirmations, links, puts, signed read addresses and deletes for every declared `file` field. */
export class RecordFilesModule extends ConfigurableModuleClass {
    /** Registers the storage binding and the services once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: RECORD_FILES_STORAGE, useExisting: options.storage },
                RecordFileFetchService,
                RecordFilesService,
                // The records of a contact as the contacts erase them (records + their files), the contacts' port.
                RecordContactErasureService,
                { provide: CONTACT_RECORDS, useExisting: RecordContactErasureService },
                // The records of an agent as its removal sees them (records + their files), the modules' port.
                RecordAgentErasureService,
                { provide: AGENT_RECORDS, useExisting: RecordAgentErasureService },
            ],
            exports: [RecordFilesService, CONTACT_RECORDS, AGENT_RECORDS],
        }
    }
}
