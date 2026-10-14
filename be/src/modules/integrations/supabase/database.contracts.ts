/** The tables, views, functions, enums and composite types of one schema; empty here because no data goes through the be's clients. */
export interface EmptySchema {
    /** The tables of the schema. */
    readonly Tables: Record<never, never>
    /** The views of the schema. */
    readonly Views: Record<never, never>
    /** The functions of the schema. */
    readonly Functions: Record<never, never>
    /** The enums of the schema. */
    readonly Enums: Record<never, never>
    /** The composite types of the schema. */
    readonly CompositeTypes: Record<never, never>
}

/**
 * The database shape the back end's Supabase clients are typed with. The back end reaches Supabase for Auth and Storage administration
 * only and reads its data through the EntityManager, so the client carries an empty `public` schema; the generated, committed schema
 * of the whole database lives in supabase/types/database.types.ts and is used by the front end and the tooling.
 */
export interface Database {
    /** The one schema the clients may name. */
    readonly public: EmptySchema
}
