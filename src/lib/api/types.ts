import { MemoryEntry, ReviewResult, AgentStep } from '@/lib/templates';

export type ApiErrorCode =
  | 'INVALID_JSON'
  | 'BODY_TOO_LARGE'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'MISCONFIGURED'
  | 'UNKNOWN_TEMPLATE'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  data: T;
}

export interface SimulatorRunRequest {
  templateId: string;
  memory?: MemoryEntry[];
}

export interface MemorySaveRequest {
  repo: string;
  entries: MemoryEntry[];
}

export type SimulatorSSEEvent =
  | { event: 'start'; data: { template: { id: string; repo: string; pr: unknown } } }
  | { event: 'step'; data: AgentStep }
  | { event: 'complete'; data: ReviewResult }
  | { event: 'memory'; data: MemoryEntry[] }
  | { event: 'error'; data: { message: string } };
