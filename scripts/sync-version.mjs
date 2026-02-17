import { readFile, writeFile } from "node:fs/promises";

async function main() {
  const version = (await readFile("VERSION", "utf8")).trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid VERSION value: "${version}"`);
  }

  const packageJsonRaw = await readFile("package.json", "utf8");
  const pkg = JSON.parse(packageJsonRaw);
  const current = pkg.version;

  if (current === version) {
    console.log(`package.json already synced at ${version}`);
    return;
  }

  pkg.version = version;
  await writeFile("package.json", `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(`Updated package.json version: ${current} -> ${version}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
