import { DynamicModule, Module } from "@nestjs/common";
import { AgentRegistry } from "./agent-registry.service";
import { GatewayClient } from "./gateway.client";
import { OPENCLAW_OPTIONS, type OpenclawOptions } from "./openclaw.config";

@Module({})
export class OpenclawModule {
  static register(options: OpenclawOptions): DynamicModule {
    return {
      module: OpenclawModule,
      providers: [{ provide: OPENCLAW_OPTIONS, useValue: options }, GatewayClient, AgentRegistry],
      exports: [GatewayClient, AgentRegistry, OPENCLAW_OPTIONS],
    };
  }
}
