import { DynamicModule, Global, Module } from "@nestjs/common";
import { ToolTokenService } from "../tools/tool-token.service";
import { NivoClient } from "./nivo-client.service";
import { NIVO_OPTIONS, type NivoOptions } from "./nivo.config";

/** The engine link to the control plane: signed calls out, per-job tool tokens. */
@Global()
@Module({})
export class NivoModule {
  static register(options: NivoOptions): DynamicModule {
    return {
      module: NivoModule,
      providers: [{ provide: NIVO_OPTIONS, useValue: options }, NivoClient, ToolTokenService],
      exports: [NIVO_OPTIONS, NivoClient, ToolTokenService],
    };
  }
}
