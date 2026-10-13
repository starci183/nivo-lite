import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { CandidateChat } from "./candidate-chat.port"
import { CvStorage } from "./cv-storage.port"
import { HiringCandidatesService } from "./hiring-candidates.service"
import { HiringChatService } from "./hiring-chat.service"
import { HiringDataService } from "./hiring-data.service"
import { HiringInterviewsService } from "./hiring-interviews.service"
import { HiringJobsService } from "./hiring-jobs.service"
import { HiringLinksService } from "./hiring-links.service"
import { HiringNotifyService } from "./hiring-notify.service"
import { HiringOffersService } from "./hiring-offers.service"
import { HiringPerformersService } from "./hiring-performers.service"
import { HiringPublicService } from "./hiring-public.service"
import { HiringScreeningService } from "./hiring-screening.service"
import { HiringSettingsService } from "./hiring-settings.service"
import { HiringTextService } from "./hiring-text.service"
import { HiringTickService } from "./hiring-tick.service"
import { HiringWorkbenchService } from "./hiring-workbench.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./hiring.module-definition"
import { UnavailableCandidateChatService } from "./unavailable-candidate-chat.service"
import { UnavailableCvStorageService } from "./unavailable-cv-storage.service"

@Module({})
/** The hiring capability over the primary Supabase PostgreSQL connection: jobs, applications, screening, interviews, offers and the tick. */
export class HiringModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CandidateChat, useClass: UnavailableCandidateChatService },
                { provide: CvStorage, useClass: UnavailableCvStorageService },
                HiringDataService,
                HiringTextService,
                HiringLinksService,
                HiringNotifyService,
                HiringSettingsService,
                HiringJobsService,
                HiringScreeningService,
                HiringCandidatesService,
                HiringInterviewsService,
                HiringOffersService,
                HiringPublicService,
                HiringChatService,
                HiringTickService,
                HiringPerformersService,
                HiringWorkbenchService,
            ],
            exports: [
                CandidateChat,
                CvStorage,
                HiringSettingsService,
                HiringJobsService,
                HiringScreeningService,
                HiringCandidatesService,
                HiringInterviewsService,
                HiringOffersService,
                HiringPublicService,
                HiringChatService,
                HiringTickService,
                HiringWorkbenchService,
            ],
        }
    }
}
