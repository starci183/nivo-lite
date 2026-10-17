import { TypeOverrides } from "pg"

/** The PostgreSQL type id of `date`. */
export const DATE_OID = 1082

/**
 * The type parsers of the app's own connections: a `date` stays its `YYYY-MM-DD` text (the form every row type and rule
 * computes with) instead of becoming a Date at local midnight, which shifts the day in any zone east or west of UTC;
 * every other type keeps the driver's parser. It is set per connection, so a customer database read by the data sources
 * keeps the driver defaults.
 */
export const appPgTypes = (): TypeOverrides => {
    const overrides = new TypeOverrides()
    overrides.setTypeParser(DATE_OID, "text", (value: string) => value)
    return overrides
}
