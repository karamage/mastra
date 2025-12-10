import { embedTypes } from '@internal/types-builder/embed-types';
import { defineConfig } from 'tsup';
import { Project } from 'ts-morph';

async function fixExportBugInDtsFile(dtsFile: string) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(dtsFile);

  // the outputted file has a bug where it's not valid typescript, we fix it by using ts transforms
  const ns = sourceFile.getModule('Output');
  if (ns) {
    ns.remove();

    const newOutput = sourceFile.addModule({
      name: 'Output',
      isExported: true,
    });
    newOutput.addExportDeclaration({
      namedExports: [
        { name: 'output_Output', alias: 'Output' },
        { name: 'output_object', alias: 'object' },
        { name: 'output_text', alias: 'text' },
      ],
    });

    await sourceFile.save();
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
        new Set(['ai', '@ai-sdk/*', '@opentelemetry/api', '@standard-schema/spec', '@types/json-schema']),
      );

      await fixExportBugInDtsFile(dtsFile);
    }
  },
});
