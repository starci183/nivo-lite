import { Module } from "@nestjs/common"
import { ChatTurnQueue } from "./chat-turn.queue"

@Module({ providers: [ChatTurnQueue], exports: [ChatTurnQueue] })
/** The chat-turn queue: its typed producer, imported by the domain module whose service enqueues. */
export class ChatTurnModule {}
