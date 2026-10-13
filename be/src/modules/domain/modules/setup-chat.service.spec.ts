import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AGENTS_QUEUE_PRODUCER } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
import { SetupChatService } from "./setup-chat.service"

const AT = "2026-10-13T03:00:00.000Z"

const build = async () => {
    const entityManager = mockEntityManager()
    const clock = new FakeClock(AT)
    const catalog = mock<MessageCatalog>()
    const queue = mock<AgentsQueue>()
    const installations = mock<InstallationRecordsService>()
    const sessions = mock<SetupSessionsService>()
    const messages = mock<SetupMessagesService>()
    const versions = mock<ContextVersionsService>()
    const members = mock<WorkspaceMembersService>()
    const modules = mock<ModulesService>()
    const agents = mock<AgentsService>()
    const events = mock<EventsService>()
    const sync = mock<AgentSyncService>()
    const cards = mock<SetupCardsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: clock },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENTS_QUEUE_PRODUCER, useValue: queue },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: ContextVersionsService, useValue: versions },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: modules },
            { provide: AgentsService, useValue: agents },
            { provide: EventsService, useValue: events },
            { provide: AgentSyncService, useValue: sync },
            { provide: SetupCardsService, useValue: cards },
        ],
    }).compile()
    return { service: moduleRef.get(SetupChatService), members, installations }
}

describe("SetupChatService", () => {
    it("does not open a draft when the caller is not an owner or a manager", async () => {
        const { service, members, installations } = await build()
        const denied = new Error("not a governor")
        members.require.mockRejectedValue(denied)

        await expect(service.state("owner-1", "ws-1", "inst-1", "en")).rejects.toBe(denied)
        expect(installations.find).not.toHaveBeenCalled()
    })
})
