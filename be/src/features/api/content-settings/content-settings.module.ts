import { Module } from "@nestjs/common"
import { ContentConfigurationHandler } from "./application/content-configuration.handler"
import { SaveContentPillarsHandler } from "./application/save-content-pillars.handler"
import { ApplyContentPillarPresetsHandler } from "./application/apply-content-pillar-presets.handler"
import { SaveContentCadenceHandler } from "./application/save-content-cadence.handler"
import { ApplyContentCadencePresetsHandler } from "./application/apply-content-cadence-presets.handler"
import { SaveContentBrandHandler } from "./application/save-content-brand.handler"
import { SetContentAutomationHandler } from "./application/set-content-automation.handler"

@Module({
    providers: [
        ContentConfigurationHandler,
        SaveContentPillarsHandler,
        ApplyContentPillarPresetsHandler,
        SaveContentCadenceHandler,
        ApplyContentCadencePresetsHandler,
        SaveContentBrandHandler,
        SetContentAutomationHandler,
    ],
})
/** CQRS application handlers for content configuration. */
export class ContentSettingsApiModule {}
