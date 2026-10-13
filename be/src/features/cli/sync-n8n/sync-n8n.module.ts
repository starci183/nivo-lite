import { Module } from "@nestjs/common"
import { SyncN8nCli } from "./sync-n8n.cli"
import { RunSyncN8nCli } from "./subs/run.cli"

@Module({ providers: [SyncN8nCli, RunSyncN8nCli] })
/** The sync-n8n group: the command and its one run; the n8n host sync is composed by the cli app. */
export class SyncN8nModule {}
