import { Field, ObjectType } from "@nestjs/graphql"
import { ContentPillarType } from "./content-pillar.type"
import { ContentCadenceType } from "./content-cadence.type"
import { ContentBrandSettingsType } from "./content-brand-settings.type"

@ObjectType()
/** ContentConfiguration returned by content settings operations. */
export class ContentConfigurationType {
    /** pillars. */
    @Field(() => [ContentPillarType])
    pillars!: Array<ContentPillarType>

    /** cadence. */
    @Field(() => [ContentCadenceType])
    cadence!: Array<ContentCadenceType>

    /** settings. */
    @Field(() => ContentBrandSettingsType)
    settings!: ContentBrandSettingsType
}
