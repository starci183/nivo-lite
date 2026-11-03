import { Field, ObjectType } from "@nestjs/graphql"
import { BindingSuggestionType } from "./binding-suggestion.type"
import { PackageReportType } from "./package-report.type"
import { PackageSummaryType } from "./package-summary.type"

@ObjectType()
/** What packaging a version would keep and leave out. */
export class PackagePreviewType {
    /** The package, or null when a problem refuses it. */
    @Field(() => PackageSummaryType, { nullable: true })
    package!: PackageSummaryType | null

    /** What was kept and what was left out. */
    @Field(() => PackageReportType)
    report!: PackageReportType

    /** Why packaging is refused. */
    @Field(() => [String])
    problems!: Array<string>

    /** Numbers of the graph that could become parameters. */
    @Field(() => [BindingSuggestionType])
    suggestions!: Array<BindingSuggestionType>
}
