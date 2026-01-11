
export interface AnalysisResult {
  jobId: string;
  status: 'success' | 'error';
  data?: {
    vendorName: string;
    invoiceDate: string;
    totalAmount: number;
    currency: string;
    accounting: {
      accountItem: string;
      confidence: number;
      reasoning: string;
    };
    projectId: string;
  };
  error?: string;
}

export interface ProgressEvent {
  event: string;
  progress?: number; // 0-100
  message?: string;
  result?: any;
}
