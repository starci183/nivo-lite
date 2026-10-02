import { DynamicModule, Module } from "@nestjs/common";
import { AgentSyncHandler } from "./features/agent-sync/agent-sync.handler";
import { AgentSyncService } from "./features/agent-sync/agent-sync.service";
import { GenerateHandler } from "./features/generate/generate.handler";
import { ChatTurnHandler } from "./features/chat-turn/chat-turn.handler";
import { ConnectionHealthHandler } from "./features/connection-health/connection-health.handler";
import { HealthController } from "./features/health/health.controller";
import { N8nEmitHandler } from "./features/n8n-emit/n8n-emit.handler";
import { N8N_OPTIONS, type N8nOptions } from "./features/n8n-emit/n8n.config";
import { TtsService } from "./features/video-render/tts/tts.service";
import { VideoRenderHandler } from "./features/video-render/video-render.handler";
import { VIDEO_OPTIONS, type VideoOptions } from "./features/video-render/video.config";
import { ToolsController } from "./features/tools/tools.controller";
import { HTTP_OPTIONS, type HttpOptions } from "./platform/config/http.config";
import { NivoModule } from "./platform/nivo/nivo.module";
import type { NivoOptions } from "./platform/nivo/nivo.config";
import { OpenclawModule } from "./platform/openclaw/openclaw.module";
import type { OpenclawOptions } from "./platform/openclaw/openclaw.config";
import type { QueueOptions } from "./platform/queue/queue.config";
import { QueueModule } from "./platform/queue/queue.module";
import { JOB_HANDLERS } from "./platform/queue/queue.types";
import { WorkerService } from "./platform/queue/worker.service";
import { SupabaseModule, type SupabaseOptions } from "./platform/supabase/supabase.module";

export type AppOptions = {
  readonly supabase: SupabaseOptions;
  readonly queue: QueueOptions;
  readonly nivo: NivoOptions;
  readonly openclaw: OpenclawOptions;
  readonly n8n: N8nOptions;
  readonly http: HttpOptions;
  readonly video: VideoOptions;
};

/**
 * Composition root. The worker loop, the six job handlers (chat.turn, connection.health, n8n.emit, openclaw.sync_agent, openclaw.generate, video.render), the tool bridge and the health
 * endpoints are composed here; every capability receives its typed options from main.ts, and only main.ts reads the environment.
 */
@Module({})
export class AppModule {
  static register(o: AppOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [SupabaseModule.register(o.supabase), NivoModule.register(o.nivo), QueueModule.register(o.queue), OpenclawModule.register(o.openclaw)],
      controllers: [HealthController, ToolsController],
      providers: [
        { provide: HTTP_OPTIONS, useValue: o.http },
        { provide: N8N_OPTIONS, useValue: o.n8n },
        { provide: VIDEO_OPTIONS, useValue: o.video },
        TtsService,
        VideoRenderHandler,
        AgentSyncService,
        AgentSyncHandler,
        GenerateHandler,
        ChatTurnHandler,
        ConnectionHealthHandler,
        N8nEmitHandler,
        { provide: JOB_HANDLERS, useFactory: (...handlers: unknown[]) => handlers, inject: [ChatTurnHandler, ConnectionHealthHandler, N8nEmitHandler, AgentSyncHandler, GenerateHandler, VideoRenderHandler] },
        WorkerService,
      ],
    };
  }
}
