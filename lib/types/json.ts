/**
 * JSON-serializable value shape for jsonb columns and API payloads.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
