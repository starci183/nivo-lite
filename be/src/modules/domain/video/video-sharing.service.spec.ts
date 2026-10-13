import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectionsService } from "@modules/domain/connections"
import { EventsService } from "@modules/domain/events"
import { MessagesService } from "@modules/domain/messages"
import { TELEGRAM } from "@modules/integrations/telegram"
import type { TelegramClient } from "@modules/integrations/telegram"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { VideoMediaService } from "./video-media.service"
import { VideoWorkbenchService } from "./video-workbench.service"
import { VideoSharingService } from "./video-sharing.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const telegram = mock<TelegramClient>()
    const workbench = mock<VideoWorkbenchService>()
    const media = mock<VideoMediaService>()
    const connections = mock<ConnectionsService>()
    const secrets = mock<ConnectionSecretsService>()
    const messages = mock<MessagesService>()
    const events = mock<EventsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoSharingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: TELEGRAM, useValue: telegram },
            { provide: VideoWorkbenchService, useValue: workbench },
            { provide: VideoMediaService, useValue: media },
            { provide: ConnectionsService, useValue: connections },
            { provide: ConnectionSecretsService, useValue: secrets },
            { provide: MessagesService, useValue: messages },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return {
        service: moduleRef.get(VideoSharingService),
        entityManager,
        telegram,
        workbench,
        media,
        connections,
        secrets,
        messages,
        events,
    }
}

describe("VideoSharingService", () => {
    describe("share", () => {
        it("share has its first case written", async () => {
            const { service } = await build()
            expect(service.share).toBeInstanceOf(Function)
        })
    })
})
