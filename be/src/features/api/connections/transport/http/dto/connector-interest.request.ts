import { IsString, Matches, MaxLength, MinLength } from "class-validator"

/** The bounded path of the connector-interest door: the id of a planned connector. */
export class ConnectorInterestParams {
    /** The planned connector, a catalog id such as shopee. */
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    @Matches(/^[a-z0-9_]+$/)
    connectorId!: string
}
