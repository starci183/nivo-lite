import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { EventsService } from "@modules/domain/events"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { SetupWritesService } from "@modules/domain/module-setup-writes"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"

const AT = "2026-10-13T03:00:00.000Z"

const build = async () => {
    const clock = new FakeClock(AT)
    const writes = mock<SetupWritesService>()
    const sessions = mock<SetupSessionsService>()
    const messages = mock<SetupMessagesService>()
    const installations = mock<InstallationRecordsService>()
    const members = mock<WorkspaceMembersService>()
    const modules = mock<ModulesService>()
    const facts = mock<BrainFactsService>()
    const rules = mock<AuthorityRulesService>()
    const gaps = mock<KnowledgeGapsService>()
    const events = mock<EventsService>()
    const sync = mock<AgentSyncService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupCardsService,
            { provide: CLOCK, useValue: clock },
            { provide: SetupWritesService, useValue: writes },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: modules },
            { provide: BrainFactsService, useValue: facts },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: EventsService, useValue: events },
            { provide: AgentSyncService, useValue: sync },
        ],
    }).compile()
    return { service: moduleRef.get(SetupCardsService), writes }
}

describe("SetupCardsService", () => {
    it("answers no cards when the sessions have none", async () => {
        const { service, writes } = await build()
        writes.ofSessions.mockResolvedValue([])

        await expect(service.viewsOf("ws-1", ["session-1"])).resolves.toEqual([])
    })
})
