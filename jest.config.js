let tsJestAvailable = false;

try {
  require.resolve("ts-jest");
  tsJestAvailable = true;
} catch {
  tsJestAvailable = false;
}

module.exports = tsJestAvailable
  ? {
      preset: "ts-jest",
      testEnvironment: "node",
      transform: {
        "^.+\\.tsx?$": "ts-jest",
      },
    }
  : {
      testEnvironment: "node",
      testMatch: ["**/tests/**/*.test.js"],
      transform: {
        "^.+\\.tsx?$": "<rootDir>/tests/ts-transformer.cjs",
      },
    };
