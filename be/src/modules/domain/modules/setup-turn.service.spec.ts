import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
import { SetupTurnService } from "./setup-turn.service"

const build = async () => {
    const catalog = mock<MessageCatalog>()
    const generations = mock<DirectGenerationService>()
    const installations = mock<InstallationRecordsService>()
    const sessions = mock<SetupSessionsService>()
    const messages = mock<SetupMessagesService>()
    const modules = mock<ModulesService>()
    const cards = mock<SetupCardsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupTurnService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: DirectGenerationService, useValue: generations },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: ModulesService, useValue: modules },
            { provide: SetupCardsService, useValue: cards },
        ],
    }).compile()
    return { service: moduleRef.get(SetupTurnService), generations }
}

describe("SetupTurnService", () => {
    it("leaves a payload of another shape unanswered", async () => {
        const { service, generations } = await build()

        await expect(service.run({})).resolves.toBeUndefined()
        expect(generations.run).not.toHaveBeenCalled()
    })
})
