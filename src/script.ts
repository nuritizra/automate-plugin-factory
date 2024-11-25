import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

const oldImportRegex =
  /import\s*{\s*createPlugin\s*,\s*} from '@backstage\/core-plugin-api';/;
const newImport = `import { createFrontendPlugin } from '@backstage/frontend-plugin-api';`;

const createApiFactoryRegex = /createApiFactory\(([^)]+)\)/g;
const createPluginIdRegex = /createPlugin\({\s*id:\s*'([^']+)'/;
const provideComponentRegex =
/export\s+const\s+([a-zA-Z0-9]+)\s*=\s*[a-zA-Z0-9]+\.provide\(\s*createComponentExtension\(\s*{\s*name:\s*['"]([a-zA-Z0-9]+)['"],\s*component:\s*{\s*lazy:\s*\(\)\s*=>\s*import\(['"]([^']+)['"]\)\.then\(\s*\(?\s*m\s*\)?\s*=>\s*m\.([a-zA-Z0-9]+)\s*,?\s*\),?\s*}\s*,?\s*}\)\,?\s*\);?/g;
const provideRoutableComponentRegex =
  /export\s+const\s+([a-zA-Z0-9]+)\s*=\s*[a-zA-Z0-9]+\.provide\(\s*createRoutableExtension\(\s*{\s*name:\s*['"]([a-zA-Z0-9]+)['"],\s*component:\s*\(\)?\s*=>\s*import\(['"]([^'"]+)['"]\)\.then\(\s*\(?\s*m\s*\)?\s*=>\s*m\.([a-zA-Z0-9]+)\s*\),\s*mountPoint:\s*([a-zA-Z0-9]+),\s*}\s*\)\,?\s*\);?/g;

const getNpmVersion = (packageName: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(`npm show ${packageName} version`, (err, stdout) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const createApisFile = (data: string, newApisFilePath: string): string[] => {
  const matches = [...data.matchAll(createApiFactoryRegex)];
  let apiNames: string[] = [];
  if (matches.length > 0) {
    const importStatements = data.match(/import\s.*?;/g) || [];
    let apisContent = matches
      .map((match) => {
        const fullMatch = match[0];
        const params = match[1];
        const apiRefMatch = params.match(/api:\s*([a-zA-Z0-9]+)Ref/);
        let apiName = "api";
        if (apiRefMatch && apiRefMatch[1]) {
          apiName = apiRefMatch[1];
        }
        apiNames.push(apiName);
        return `export const ${apiName} = ApiBlueprint.make({
    params: {
        factory: ${fullMatch}
    }
});`;
      })
      .join("\n\n");

    apisContent = `import { ApiBlueprint } from '@backstage/plugin-catalog-react/alpha';\n\n${importStatements.join(
      "\n"
    )}\n\n${apisContent}`;
    fs.writeFileSync(newApisFilePath, apisContent, "utf8");
    console.log("Apis file created successfully");
  } else {
    console.log("No createApiFactory found in the file");
  }
  return apiNames;
};

const createEntityContentFile = (data: string, newEntityContentFilePath: string): string[] => {
  const matches = [...data.matchAll(provideRoutableComponentRegex)];
  let entityContentNames: string[] = [];
  if (matches.length > 0) {
    let entityContent = `import React from 'react';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

/**
 * @alpha
 */
`;

    entityContent += matches
      .map((match) => {
        const [
          fullMatch,
          constName,
          componentName,
          importPath,
          component,
          mountPoint,
        ] = match;
        entityContentNames.push(constName);
        return `export const ${constName} = EntityContentBlueprint.make({
  name: '${componentName}',
  params: {
    defaultPath: '${componentName.toLowerCase()}',
    defaultTitle: '${componentName}',
    filter: 'kind:component',
    loader: () =>
      import('${importPath}').then(m => (
        <m.${component} />
      )),
  },
});`;
      })
      .join("\n\n");

    fs.writeFileSync(newEntityContentFilePath, entityContent, "utf8");
    console.log("Entity content file created successfully");
  } else {
    console.log("No provide routable component found in the file");
  }
  return entityContentNames;
};

const createEntityCardsFile = (data: string, newEntityCardFilePath: string): string[] => {
  const matches = [...data.matchAll(provideComponentRegex)];
  let entityCardNames: string[] = [];
  if (matches.length > 0) {
    let entityCards = `import React from 'react';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

/**
 * @alpha
 */
`;

    entityCards += matches
      .map((match) => {
        const [fullMatch, constName, componentName, importPath, component] =
          match;
        entityCardNames.push(constName);
        return `export const ${constName} = EntityCardBlueprint.make({
    name: '${componentName}',
    params: {
        filter: 'kind:component',
        loader: () =>
            import('${importPath}').then(m => (
                <m.${component} />
            )),
        },
    });`;
      })
      .join("\n\n");

    fs.writeFileSync(newEntityCardFilePath, entityCards, "utf8");
    console.log("Entity cards file created successfully");
  } else {
    console.log("No provide provideComponentRegex found in the file");
  }
  return entityCardNames;
};

const createPluginFile = (
  data: string,
  apiNames: string[],
  entityCardNames: string[],
  entityContentNames: string[],
  pluginId: string,
  newPluginFilePath: string
) => {
  const newPluginContent = `
${newImport}
${entityCardNames
  .map((name) => `import { ${name} } from './entityCard';`)
  .join("\n")}
${entityContentNames
  .map((name) => `import { ${name} } from './entityContent';`)
  .join("\n")}
${apiNames.map((apiName) => `import { ${apiName} } from './apis';`).join("\n")}

/**
 * @alpha
 */
export default createFrontendPlugin({
  id: '${pluginId}',
  extensions: [${[...apiNames, ...entityCardNames, ...entityContentNames].join(
    ", "
  )}],
});
  `;

  fs.writeFileSync(newPluginFilePath, newPluginContent, "utf8");
  console.log("New plugin file created successfully");
};

const createAlphaFile = (newAlphaFilePath: string) => {
  const alphaContent = `export { default } from './alpha/index';`;
  fs.writeFileSync(newAlphaFilePath, alphaContent, "utf8");
  console.log("Alpha file created successfully");
};

const createIndexFile = (newIndexFilePath: string) => {
  const indexContent = `export { default } from './plugin';`;
  fs.writeFileSync(newIndexFilePath, indexContent, "utf8");
  console.log("Index file created successfully");
};

const updatePackageJson = async (packageJsonPath: string) => {
  try {
    const [frontendAppApiVersion, frontendPluginApiVersion] = await Promise.all(
      [
        getNpmVersion("@backstage/frontend-app-api"),
        getNpmVersion("@backstage/frontend-plugin-api"),
      ]
    );

    const packageJsonData = fs.readFileSync(packageJsonPath, "utf8");
    let packageJson = JSON.parse(packageJsonData);

    packageJson.exports = {
      ".": "./src/index.ts",
      "./alpha": "./src/alpha.ts",
      "./package.json": "./package.json",
    };

    packageJson.typesVersions = {
      "*": {
        alpha: ["src/alpha.ts"],
        "package.json": ["package.json"],
      },
    };

    packageJson.dependencies = {
      ...packageJson.dependencies,
      "@backstage/frontend-app-api": `^${frontendAppApiVersion}`,
      "@backstage/frontend-plugin-api": `^${frontendPluginApiVersion}`,
    };

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf8"
    );
    console.log("package.json updated successfully");
  } catch (err) {
    console.error(`Error fetching package versions: ${err}`);
  }
};

const migrate_frontend_plugin = async (repoPath: string) => {
  try {
    const pluginFilePath = path.join(repoPath, "src", "plugin.ts");
    const newPluginFilePath = path.join(repoPath, "src", "alpha", "plugin.ts");
    const newApisFilePath = path.join(repoPath, "src", "alpha", "apis.ts");
    const newEntityCardFilePath = path.join(repoPath, "src", "alpha", "entityCard.ts");
    const newEntityContentFilePath = path.join(repoPath, "src", "alpha", "entityContent.ts");
    const newAlphaFilePath = path.join(repoPath, "src", "alpha.ts");
    const newIndexFilePath = path.join(repoPath, "src", "alpha", "index.ts");
    const packageJsonPath = path.join(repoPath, "package.json");

    const data = fs.readFileSync(pluginFilePath, "utf8");
    const updatedData = data.replace(oldImportRegex, newImport);
    const pluginIdMatch = data.match(createPluginIdRegex);
    const pluginId = pluginIdMatch ? pluginIdMatch[1] : "plugin-id";

    fs.mkdirSync(path.dirname(newPluginFilePath), { recursive: true });

    const apiNames = createApisFile(data, newApisFilePath);
    const entityCardNames = createEntityCardsFile(data, newEntityCardFilePath);
    const entityContentNames = createEntityContentFile(data, newEntityContentFilePath);
    createPluginFile(
      updatedData,
      apiNames,
      entityCardNames,
      entityContentNames,
      pluginId,
      newPluginFilePath
    );
    createAlphaFile(newAlphaFilePath);
    createIndexFile(newIndexFilePath);
    await updatePackageJson(packageJsonPath);
  } catch (err) {
    console.error(`Error during migration: ${err}`);
  }
};

const main = () => {
  const repoPath = process.argv[2];
  if (repoPath) {
    migrate_frontend_plugin(repoPath);
  } else {
    console.error("Please provide the repoPath as an argument.");
  }
};

main();
