// Compatibility entry point; share the restricted server documented in README.
process.argv[2] ||= "5178";
import("./serve.mjs").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
