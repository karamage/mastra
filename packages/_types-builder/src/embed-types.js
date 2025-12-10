import fs from 'fs/promises';
import path from 'path';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';

export async function embedTypes(file, rootDir, bundledPackages) {
  const packageJsonFullPath = path.join(rootDir, 'package.json');
  const pkgJson = JSON.parse(await fs.readFile(packageJsonFullPath, 'utf8'));

  // Load and parse the api-extractor.json file
  /** @type {ExtractorConfig} */
  const extractorConfig = ExtractorConfig.prepare({
    packageFolder: rootDir,
    packageJson: pkgJson,
    packageJsonFullPath,
    configObject: {
      $schema: 'https://developer.microsoft.com/json-schemas/api-extractor/v7/api-extractor.schema.json',
      mainEntryPointFilePath: file,
      bundledPackages: Array.from(bundledPackages),
      compiler: {
        tsconfigFilePath: path.join(rootDir, 'tsconfig.build.json'),
      },
      messages: {
        extractorMessageReporting: {
          'ae-forgotten-export': {
            logLevel: 'warning',
          },
        },
      },
      projectFolder: rootDir,
      dtsRollup: {
        enabled: true,
        publicTrimmedFilePath: path.relative(rootDir, file),
      },
      apiReport: {
        enabled: false,
      },
      docModel: {
        enabled: false,
      },
    },
  });

  // Invoke API Extractor
  const extractorResult = Extractor.invoke(extractorConfig, {
    localBuild: true,
    showVerboseMessages: false,
    showDiagnostics: false,
    messageCallback: () => {},
  });

  // console.log('extractorResult', { extractorResult });
  if (extractorResult.succeeded) {
    // console.log(extractorResult.compilerState);
    console.log(`API Extractor completed successfully`);
  } else {
    throw new Error(
      `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`,
    );
  }
}
