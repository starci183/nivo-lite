import { Field, ObjectType } from "@nestjs/graphql"
import { DossierFindingPageInfoType } from "./dossier-finding-page-info.type"
import { DossierFindingType } from "./dossier-finding.type"

@ObjectType()
/** A page of findings and the cursor for the next page. */
export class DossierFindingConnectionType {
    /** The findings, severity first. */
    @Field(() => [DossierFindingType])
    nodes!: ReadonlyArray<DossierFindingType>

    /** Whether another page exists and where it begins. */
    @Field(() => DossierFindingPageInfoType)
    pageInfo!: DossierFindingPageInfoType
}
