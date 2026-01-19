// Type definitions for ingestion service responses

export interface InvoiceData {
  invoice_id: string;
  file_url?: string | null;
  // original uploaded file name
  file_name?: string | null;
  ocr_result?: unknown | null;
  // AI inference result (optional, added when analysis completes)
  ai_result?: {
    totalAmount?: number;
    invoiceDate?: string;
    currency?: string;
    projectId?: string;
    // optional file name propagated into AI result for UI display
    file_name?: string | null;
    accounting?: Array<{
      accountItem: string;
      confidence: number;
      reasoning?: string;
      amount?: number;
    }>;
    summary?: string;
    // allow arbitrary extra fields
    [key: string]: unknown;
  } | null;
}

export interface Message {
  id: string;
  role: string;
  type: string;
  content: string;
  invoiceData?: InvoiceData | null;
  suggestions: unknown[];
}

export interface ChatResponse {
  jobId: string;
  status: 'success' | 'error' | 'canceled';
  messages: Message[];
}
