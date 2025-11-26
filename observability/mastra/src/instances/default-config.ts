/**
 * DefaultObservabilityConfig - Pre-configured default observability instance
 *
 * This class provides a convenient way to use the recommended default configuration
 * for Mastra observability without needing to specify all the options manually.
 */

import { SamplingStrategyType } from '../config';
import { CloudExporter, DefaultExporter } from '../exporters';
import { SensitiveDataFilter } from '../span_processors';
import { DefaultObservabilityInstance } from './default';

/**
 * Pre-configured observability instance with Mastra's recommended defaults:
 *
 * - Service Name: "mastra"
 * - Sampling: Always (100% of traces)
 * - Exporters: DefaultExporter (storage) + CloudExporter (Mastra Cloud)
 * - Processors: SensitiveDataFilter (redacts sensitive data)
 *
 * @example
 * ```typescript
 * import { Observability, DefaultObservabilityConfig } from "@mastra/observability";
 *
 * export const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: { default: new DefaultObservabilityConfig() },
 *   }),
 *   storage: new LibSQLStore({ url: "file:./mastra.db" }),
 * });
 * ```
 */
export class DefaultObservabilityConfig extends DefaultObservabilityInstance {
  constructor() {
    super({
      serviceName: 'mastra',
      name: 'default',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [new DefaultExporter(), new CloudExporter()],
      spanOutputProcessors: [new SensitiveDataFilter()],
    });
  }
}
