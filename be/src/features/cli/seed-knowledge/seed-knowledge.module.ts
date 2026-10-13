import { Module } from "@nestjs/common"
import { SeedKnowledgeCli } from "./seed-knowledge.cli"
import { RunSeedKnowledgeCli } from "./subs/run.cli"

@Module({ providers: [SeedKnowledgeCli, RunSeedKnowledgeCli] })
/** The base knowledge seed group: the command that mirrors the knowledge folder into public.nivo_knowledge. */
export class SeedKnowledgeModule {}
