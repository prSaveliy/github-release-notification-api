export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}