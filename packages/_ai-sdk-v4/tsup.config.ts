import { embedTypes } from '@internal/types-builder/embed-types';
import type { ExportDeclaration } from 'ts-morph';
import { Project, SyntaxKind, Node } from 'ts-morph';
import { defineConfig } from 'tsup';

async function fixExportBugInDtsFile(dtsFile: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(dtsFile);

  let changed = false;
  // the outputted file has a bug where it's not valid typescript, we fix it by using ts transforms
  // const ouputNs = sourceFile.getModule('Output');
  // if (ouputNs) {
  //   ouputNs.remove();

  //   const newOutput = sourceFile.addModule({
  //     name: 'Output',
  //     isExported: true,
  //   });
  //   newOutput.addExportDeclaration({
  //     namedExports: [
  //       { name: 'output_Output', alias: 'Output' },
  //       { name: 'output_object', alias: 'object' },
  //       { name: 'output_text', alias: 'text' },
  //     ],
  //   });
  //   changed = true;
  // }

  // const langChainAdapterNs = sourceFile.getModule('LangChainAdapter');
  // if (langChainAdapterNs) {
  //   langChainAdapterNs.remove();

  //   const newOutput = sourceFile.addModule({
  //     name: 'LangChainAdapter',
  //     isExported: true,
  //   });
  //   newOutput.addExportDeclaration({
  //     namedExports: [
  //       { name: 'mergeIntoDataStream$1', alias: 'mergeIntoDataStream' },
  //       { name: 'toDataStream$1', alias: 'toDataStream' },
  //       { name: 'toDataStreamResponse$1', alias: 'toDataStreamResponse' },
  //     ],
  //   });
  // }

  let fixCount = 0;

  for (const mod of sourceFile.getModules()) {
    const body = mod.getBody();
    if (!body || !Node.isModuleBlock(body)) {
      continue;
    }

    // Get the syntax list containing statements
    const syntaxList = body.getChildSyntaxList();
    if (!syntaxList) {
      continue;
    }

    const moduleName = mod.getName();
    const declarations: ExportDeclaration[] = [];
    for (const child of syntaxList.getChildren()) {
      if (child.getKind() === SyntaxKind.Block) {
        const text = child.getText().trim();

        // Pattern: starts with { and contains "identifier as identifier"
        const startsWithBrace = text.startsWith('{');
        const endsWithBrace = text.endsWith('};') || text.endsWith('}');

        if (startsWithBrace && endsWithBrace) {
          const tmpProject = new Project();
          const tmpFile = tmpProject.createSourceFile('tmp.dts', `export ${text}`);

          declarations.push(...tmpFile.getExportDeclarations());
          fixCount++;
        }
      }
    }

    if (declarations.length) {
      mod.remove();
      const newModule = sourceFile.addModule({
        name: moduleName,
        isExported: true,
      });

      declarations.forEach(declaration => {
        const exports = declaration.getNamedExports().map(specifier => {
          return {
            name: specifier.getName(),
            alias: specifier.getAliasNode()?.getText(),
          };
        });

        // @ts-expect-error - not sure what's broken here
        newModule.addExportDeclaration({
          namedExports: exports,
        });
      });
    }
  }

  if (fixCount > 0) {
    // sourceFile.saveSync();
    console.log(`Fixed ${fixCount} broken namespace export(s)`);
    await sourceFile.save();
  }

  if (changed) {
    // await sourceFile.save();
  }
}

export default defineConfig({
  entry: ['src/index.ts', 'src/internal.ts', 'src/test.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  metafile: true,
  sourcemap: true,
  onSuccess: async () => {
    const { copyAIDtsFiles } = await import('./scripts/copy-ai-dts-files.js');
    const dtsFiles = await copyAIDtsFiles();

    for (const dtsFile of dtsFiles) {
      await embedTypes(
        dtsFile,
        process.cwd(),
        new Set(['ai', '@ai-sdk/*', '@opentelemetry/api', '@types/json-schema']),
      );

      await fixExportBugInDtsFile(dtsFile);
    }
  },
});
