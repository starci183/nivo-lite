/** The specs of the SDK run beside its sources, with every logic file held at 100 on all four metrics (BE-TEST-13). */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    rootDir: ".",
    roots: ["<rootDir>/src"],
    testMatch: ["**/*.spec.ts"],
    transform: {
        "^.+\.ts$": ["ts-jest", { tsconfig: { isolatedModules: true, sourceMap: true }, diagnostics: false }],
    },
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.spec.ts",
        "!src/**/index.ts",
        "!src/**/*.types.ts",
        "!src/testing/**",
    ],
    coverageThreshold: { "./src/": { lines: 100, branches: 100, functions: 100, statements: 100 } },
}
