import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatTypingService } from "@modules/domain/chat-typing"
import { REALTIME_PUBLISHER, RealtimeService } from "@modules/platform/realtime"
import { ChatMarkersProofModule } from "./chat-markers-proof.module"

@Module({
    imports: [ChatMarkersProofModule.register()],
    providers: [ChatTypingService, { provide: REALTIME_PUBLISHER, useClass: RealtimeService }],
    exports: [ChatTypingService],
})
/** Real target admission and private broadcast publishing over the isolated PostgreSQL stack. */
export class ChatTypingProofModule {
    /** Registers only the typing proof's dependencies. */
    static register(): DynamicModule {
        return { module: ChatTypingProofModule }
    }
}
