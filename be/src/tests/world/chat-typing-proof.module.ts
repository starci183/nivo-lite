import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatTypingService } from "@modules/domain/chat-typing"
import { MemoryRealtimeHubService, REALTIME_HUB } from "@modules/platform/realtime"
import { ChatMarkersProofModule } from "./chat-markers-proof.module"

@Module({
    imports: [ChatMarkersProofModule.register()],
    providers: [ChatTypingService, { provide: REALTIME_HUB, useClass: MemoryRealtimeHubService }],
    exports: [ChatTypingService],
})
/** Real target admission and typing publishing through the memory hub over the isolated PostgreSQL stack. */
export class ChatTypingProofModule {
    /** Registers only the typing proof's dependencies. */
    static register(): DynamicModule {
        return { module: ChatTypingProofModule }
    }
}
