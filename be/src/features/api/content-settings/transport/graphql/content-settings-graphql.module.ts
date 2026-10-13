import { Module } from "@nestjs/common"
import { ContentSettingsApiModule } from "../../content-settings.module"
import { ContentConfigurationResolver } from "./content-configuration.resolver"
import { SaveContentPillarsResolver } from "./save-content-pillars.resolver"
import { ApplyContentPillarPresetsResolver } from "./apply-content-pillar-presets.resolver"
import { SaveContentCadenceResolver } from "./save-content-cadence.resolver"
import { ApplyContentCadencePresetsResolver } from "./apply-content-cadence-presets.resolver"
import { SaveContentBrandResolver } from "./save-content-brand.resolver"
import { SetContentAutomationResolver } from "./set-content-automation.resolver"

@Module({
    imports: [ContentSettingsApiModule],
    providers: [
        ContentConfigurationResolver,
        SaveContentPillarsResolver,
        ApplyContentPillarPresetsResolver,
        SaveContentCadenceResolver,
        ApplyContentCadencePresetsResolver,
        SaveContentBrandResolver,
        SetContentAutomationResolver,
    ],
})
/** GraphQL transport of the content settings feature. */
export class ContentSettingsGraphqlModule {}
