import type { CodegenConfig } from "@graphql-codegen/cli"

/** Generates the wire types of the front end from the committed back end contract (never hand-typed). */
const config: CodegenConfig = {
    schema: "../../../be/contracts/api/schema.graphql",
    generates: {
        "src/modules/api/graphql/__generated__/schema.ts": {
            plugins: ["typescript"],
            config: { enumsAsTypes: true, skipTypename: true, scalars: { ID: "string" } },
        },
    },
}

export default config
