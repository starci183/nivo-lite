import { Module } from "@nestjs/common"
import { SeedWorkspaceCli } from "./seed-workspace.cli"
import { ConfigurableModuleClass } from "./seed-workspace.module-definition"
import { RunSeedWorkspaceCli } from "./subs/run.cli"
import { EnsureSeedWorkspaceCli } from "./subs/ensure.cli"
import { RoleSeedWorkspaceCli } from "./subs/role.cli"
import { VerifySeedWorkspaceCli } from "./subs/verify.cli"
import { ProfileSeedWorkspaceCli } from "./subs/profile.cli"

@Module({
    providers: [
        SeedWorkspaceCli,
        RunSeedWorkspaceCli,
        EnsureSeedWorkspaceCli,
        RoleSeedWorkspaceCli,
        VerifySeedWorkspaceCli,
        ProfileSeedWorkspaceCli,
    ],
})
/** Registers ensure, authenticated role and recovery without domain writes, plus the equally scoped run alias. */
export class SeedWorkspaceModule extends ConfigurableModuleClass {}
