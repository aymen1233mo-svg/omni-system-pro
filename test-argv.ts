const isDirectExecution = 
  (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) ||
  (Boolean(process.argv[1]) && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.cjs") || process.argv[1].includes("tsx") || process.argv[1].includes("test-argv.ts")));
console.log(process.argv);
console.log("isDirectExecution:", isDirectExecution);
