export interface AnalysisResult {
  jobId: string;
  status: 'success' | 'error';
  data?: {
    // 表示用（バックエンドの payload に合わせて optional）
    file_name?: string;
    fileName?: string;
    vendorName?: string;
    invoiceDate?: string;
    totalAmount?: number;
    currency?: string;
    accounting?: {
      accountItem?: string;
      confidence?: number;
      reasoning?: string;
    };
    accountingList?: Array<unknown>;
    projectId?: string;

    // MF CSV
    mfCsvUrl?: string;
    mfCsvText?: string; // mf_csv の本文
    hasMfCsv?: boolean;

    invoiceId?: string;
  };
  error?: string;
}

export interface ProgressEvent {
  event: string;
  progress?: number; // 0-100
  message?: string;
  result?: unknown;
}
