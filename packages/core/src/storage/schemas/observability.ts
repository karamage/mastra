
import { z } from 'zod';

import { SpanType, EntityType } from '../../observability';
import type { StorageColumn } from '../types';

export interface SpanRecord {
  traceId: string; // Unique trace identifier
  spanId: string; // Unique span identifier within the trace
  parentSpanId: string | null; // Parent span reference (null = root span)
  name: string; // Human-readable span name

  // Entity identification - first-class fields for filtering
  entityType: EntityType | null; // 'agent' | 'processor' | 'tool' | 'workflow'
  entityId: string | null; // ID of the entity (e.g., 'weatherAgent', 'orderWorkflow')
  entityName: string | null; // Name of the entity

  // Identity & Tenancy
  userId: string | null; // Human end-user who triggered the trace
  organizationId: string | null; // Multi-tenant organization/account
  resourceId: string | null; // Broader resource context (Mastra memory compatibility)

  // Correlation IDs
  runId: string | null; // Unique execution run identifier
  sessionId: string | null; // Session identifier for grouping traces
  threadId: string | null; // Conversation thread identifier
  requestId: string | null; // HTTP request ID for log correlation

  // Deployment context (these items only exist on the root span)
  environment: string | null; // 'production' | 'staging' | 'development'
  source: string | null; // 'local' | 'cloud' | 'ci'
  serviceName: string | null; // Name of the service
  scope: Record<string, any> | null; // Arbitrary package/app version info {"core": "1.0.0", "memory": "1.0.0", "gitSha": "abcd1234"}

  // Span data
  spanType: SpanType; // WORKFLOW_RUN, AGENT_RUN, TOOL_CALL, etc.
  attributes: Record<string, any> | null; // Span-type specific attributes (e.g., model, tokens, tools)
  metadata: Record<string, any> | null; // User-defined metadata for custom filtering
  tags: string[] | null; // Labels for filtering traces (only on the root span)
  links: any; // References to related spans in other traces
  input: any; // Input data passed to the span
  output: any; // Output data returned from the span
  error: any; // Error info - presence indicates failure (status derived from this)
  isEvent: boolean; // Whether this is an event (point-in-time) vs a span (duration)

  // Timestamps
  startedAt: Date; // When the span started
  endedAt: Date | null; // When the span ended (null = running, status derived from this)
  createdAt: Date; // Database record creation time
  updatedAt: Date | null; // Database record last update time
}

export const SPAN_SCHEMA: Record<string, StorageColumn> = {
  // Composite primary key of traceId and spanId
  traceId: { type: 'text', nullable: false }, // Unique trace identifier
  spanId: { type: 'text', nullable: false }, // Unique span identifier within the trace
  parentSpanId: { type: 'text', nullable: true }, // Parent span reference (null = root span)
  name: { type: 'text', nullable: false }, // Human-readable span name
  scope: { type: 'jsonb', nullable: true }, // Mastra package versions {"core": "1.0.0", "memory": "1.0.0"}
  spanType: { type: 'text', nullable: false }, // WORKFLOW_RUN, WORKFLOW_STEP, AGENT_RUN, AGENT_STEP, TOOL_RUN, TOOL_STEP, etc.

  // Entity identification - first-class fields for filtering
  entityType: { type: 'text', nullable: true }, // 'agent' | 'workflow' | 'tool' | 'network' | 'step'
  entityId: { type: 'text', nullable: true }, // ID/name of the entity (e.g., 'weatherAgent', 'orderWorkflow')
  entityName: { type: 'text', nullable: true }, // Human-readable display name

  // Identity & Tenancy
  userId: { type: 'text', nullable: true }, // Human end-user who triggered the trace
  organizationId: { type: 'text', nullable: true }, // Multi-tenant organization/account
  resourceId: { type: 'text', nullable: true }, // Broader resource context (Mastra memory compatibility)

  // Correlation IDs
  runId: { type: 'text', nullable: true }, // Unique execution run identifier
  sessionId: { type: 'text', nullable: true }, // Session identifier for grouping traces
  threadId: { type: 'text', nullable: true }, // Conversation thread identifier
  requestId: { type: 'text', nullable: true }, // HTTP request ID for log correlation

  // Deployment context
  environment: { type: 'text', nullable: true }, // 'production' | 'staging' | 'development'
  source: { type: 'text', nullable: true }, // 'local' | 'cloud' | 'ci'
  serviceName: { type: 'text', nullable: true }, // Name of the service
  deploymentId: { type: 'text', nullable: true }, // Specific deployment/release identifier
  versionInfo: { type: 'jsonb', nullable: true }, // App version info {"app": "1.0.0", "gitSha": "abc123"}

  // Span data
  attributes: { type: 'jsonb', nullable: true }, // Span-type specific attributes (e.g., model, tokens, tools)
  metadata: { type: 'jsonb', nullable: true }, // User-defined metadata for custom filtering
  tags: { type: 'jsonb', nullable: true }, // string[] - labels for filtering traces
  links: { type: 'jsonb', nullable: true }, // References to related spans in other traces
  input: { type: 'jsonb', nullable: true }, // Input data passed to the span
  output: { type: 'jsonb', nullable: true }, // Output data returned from the span
  error: { type: 'jsonb', nullable: true }, // Error info - presence indicates failure

  // Timestamps
  startedAt: { type: 'timestamp', nullable: false }, // When the span started
  endedAt: { type: 'timestamp', nullable: true }, // When the span ended (null = running)
  createdAt: { type: 'timestamp', nullable: false }, // Database record creation time
  updatedAt: { type: 'timestamp', nullable: true }, // Database record last update time

  isEvent: { type: 'boolean', nullable: false }, // Whether this is an event (point-in-time) vs a span (duration)
};

export type CreateSpanRecord = Omit<SpanRecord, 'createdAt' | 'updatedAt'>;
export type UpdateSpanRecord = Omit<CreateSpanRecord, 'spanId' | 'traceId'>;

export interface TraceRecord {
  traceId: string;
  spans: SpanRecord[];
}


// ============================================================================
// Core Type Schemas (source of truth with proper types)
// ============================================================================

/**
 * Pagination arguments for list queries (page and perPage only)
 * Uses z.coerce to handle string → number conversion from query params
 */
export const paginationArgsSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().describe('Zero-indexed page number'),
    perPage: z.coerce.number().int().min(1).optional().describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

/**
 * Date range for filtering by time
 * Uses z.coerce to handle ISO string → Date conversion from query params
 */
export const dateRangeSchema = z
  .object({
    start: z.coerce.date().optional().describe('Start of date range (inclusive)'),
    end: z.coerce.date().optional().describe('End of date range (inclusive)'),
  })
  .describe('Date range filter for timestamps');

/**
 * Fields available for ordering trace results
 */
export const tracesOrderByFieldSchema = z
  .enum(['startedAt', 'endedAt'])
  .describe("Field to order by: 'startedAt' | 'endedAt'");

/**
 * Sort direction for ordering
 */
export const sortDirectionSchema = z.enum(['ASC', 'DESC']).describe("Sort direction: 'ASC' | 'DESC'");

/**
 * Order by configuration for trace queries
 * Follows the existing StorageOrderBy pattern
 */
export const tracesOrderBySchema = z
  .object({
    field: tracesOrderByFieldSchema.optional().describe('Field to order by'),
    direction: sortDirectionSchema.optional().describe('Sort direction'),
  })
  .describe('Order by configuration');

/**
 * Filters for querying traces (with proper types)
 */
export const tracesFilterSchema = z
  .object({
    // Date range filters for startedAt and endedAt
    startedAt: dateRangeSchema.optional().describe('Filter by span start time range'),
    endedAt: dateRangeSchema.optional().describe('Filter by span end time range'),

    // Span type filter
    spanType: spanTypeSchema.optional().describe('Filter by span type'),

    // Entity filters
    entityType: spanEntityTypeSchema.optional().describe('Filter by entity type'),
    entityId: z.string().optional().describe('Filter by entity ID (e.g., "weatherAgent", "orderWorkflow")'),
    entityName: z.string().optional().describe('Filter by human-readable entity name'),

    // Identity & Tenancy filters
    userId: z.string().optional().describe('Filter by human end-user who triggered the trace'),
    organizationId: z.string().optional().describe('Filter by multi-tenant organization/account'),
    resourceId: z.string().optional().describe('Filter by resource context (Mastra memory compatibility)'),

    // Correlation ID filters
    runId: z.string().optional().describe('Filter by unique execution run identifier'),
    sessionId: z.string().optional().describe('Filter by session identifier for grouping traces'),
    threadId: z.string().optional().describe('Filter by conversation thread identifier'),
    requestId: z.string().optional().describe('Filter by HTTP request ID for log correlation'),

    // Deployment context filters
    environment: z.string().optional().describe("Filter by environment: 'production' | 'staging' | 'development'"),
    source: z.string().optional().describe("Filter by source: 'local' | 'cloud' | 'ci'"),
    serviceName: z.string().optional().describe('Filter by service name'),
    deploymentId: z.string().optional().describe('Filter by specific deployment/release identifier'),

    // Span data filters
    metadata: z.record(z.unknown()).optional().describe('Key-value matching on user-defined metadata'),
    tags: z
      .preprocess(
        val => (typeof val === 'string' ? val.split(',').filter(t => t.trim() !== '') : val),
        z.array(z.string()).optional(),
      )
      .describe('Match traces with any of these tags'),
    scope: z.record(z.unknown()).optional().describe('Key-value matching on Mastra package versions'),
    versionInfo: z.record(z.unknown()).optional().describe('Key-value matching on app version info'),

    // Derived status filters
    status: spanStatusSchema.optional().describe('Filter by root span status'),
    hasChildError: z
      .preprocess(val => (val === 'true' ? true : val === 'false' ? false : val), z.boolean().optional())
      .describe('True = any child span in the trace has an error (even if root succeeded)'),
  })
  .describe('Filters for querying traces');

/**
 * Arguments for paginated trace queries
 */
export const tracesPaginatedArgSchema = z
  .object({
    filters: tracesFilterSchema.optional().describe('Optional filters to apply'),
    pagination: paginationArgsSchema.optional().describe('Optional pagination settings'),
    orderBy: tracesOrderBySchema.optional().describe('Optional ordering configuration'),
  })
  .describe('Arguments for paginated trace queries');

// ============================================================================
// Inferred Types
// ============================================================================

export type SpanEntityType = z.infer<typeof spanEntityTypeSchema>;
export type SpanStatus = z.infer<typeof spanStatusSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;
export type PaginationArgs = z.infer<typeof paginationArgsSchema>;
export type TracesOrderByField = z.infer<typeof tracesOrderByFieldSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
export type TracesOrderBy = z.infer<typeof tracesOrderBySchema>;
export type TracesFilter = z.infer<typeof tracesFilterSchema>;
export type TracesPaginatedArg = z.infer<typeof tracesPaginatedArgSchema>;

// ============================================================================
// Query Parameter Translation (Server-Side)
// ============================================================================

/**
 * Query parameter format (URL) - using qs bracket notation:
 *
 * Simple strings:     ?filters[entityId]=abc&filters[userId]=user_123
 * Pagination:         ?pagination[page]=0&pagination[perPage]=20
 * Date range:         ?filters[dateRange][start]=2024-01-01T00:00:00Z
 * Arrays:             ?filters[tags][0]=prod&filters[tags][1]=v2
 * Nested objects:     ?filters[metadata][key1]=val1&filters[metadata][key2]=val2
 * Booleans:           ?filters[hasChildError]=true
 *
 * The qs library handles the bracket notation bidirectionally.
 */

interface ValidationError {
  field: string;
  message: string;
}

interface ParseResult {
  success: true;
  data: TracesPaginatedArg;
}

interface ParseErrorResult {
  success: false;
  errors: ValidationError[];
}

/**
 * Simple scalar filter keys that go at root level (not nested)
 */
const SCALAR_FILTER_KEYS = [
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
  'deploymentId',
  'status',
  'hasChildError',
] as const;


// Derived status helper (status is computed from error/endedAt, not stored)
export function getSpanStatus(span: { error: any; endedAt: Date | null }): 'success' | 'error' | 'running' {
  if (span.error) return 'error';
  if (span.endedAt === null) return 'running';
  return 'success';
}



// Status filter (derived: 'error' = has error, 'running' = no endedAt, 'success' = endedAt and no error)
export type SpanStatus = 'error' | 'running' | 'success';

export interface TracesPaginatedArg {
  filters?: {
    // Span type filter
    spanType?: SpanType;

    // Entity filters
    entityType?: SpanEntityType;
    entityId?: string;
    entityName?: string;

    // Status filter
    status?: SpanStatus;

    // Tag filter (match any of these tags)
    tags?: string[];

    // Identity & Tenancy filters
    userId?: string;
    organizationId?: string;
    resourceId?: string;

    // Correlation ID filters
    runId?: string;
    sessionId?: string;
    threadId?: string;
    requestId?: string;

    // Deployment context filters
    environment?: string;
    source?: string;
    serviceName?: string;
    deploymentId?: string;

    // JSONB filters (key-value matching)
    metadata?: Record<string, unknown>;
    scope?: Record<string, unknown>;
  };
  pagination?: PaginationArgs;
}