// Dify API types

declare global {
  interface UploadedFile {
    id?: string;
    name: string;
    filename?: string;
    previewUrl?: string;
    uploading?: boolean;
    original?: File;
    size?: number;
    type?: string;
    url?: string;
    error?: string;
  }

  interface DifyFile {
    type: 'document' | 'image' | 'audio' | 'video' | 'custom';
    transfer_method: 'remote_url' | 'local_file';
    url?: string;
    upload_file_id?: string;
  }

  interface DifyChatRequest {
    query: string;
    inputs?: Record<string, any>;
    response_mode?: 'streaming' | 'blocking';
    user?: string;
    conversation_id?: string;
    files?: DifyFile[];
    auto_generate_name?: boolean;
    workflow_id?: string;
    trace_id?: string;
  }

  interface RetrieverResource {
    position: number;
    dataset_id: string;
    dataset_name: string;
    document_id: string;
    document_name: string;
    segment_id: string;
    score: number;
    content: string;
  }

  interface Usage {
    prompt_tokens: number;
    prompt_unit_price: string;
    prompt_price_unit: string;
    prompt_price: string;
    completion_tokens: number;
    completion_unit_price: string;
    completion_price_unit: string;
    completion_price: string;
    total_tokens: number;
    total_price: string;
    currency: string;
    latency: number;
  }

  interface DifyConversation {
    id: string;
    name: string;
    inputs: Record<string, unknown>;
    introduction?: string;
    created_at: number;
    updated_at: number;
  }

  interface DifyMessage {
    id: string;
    conversation_id: string;
    inputs: Record<string, unknown>;
    query: string;
    answer: string;
    message_files: UploadedFile[];
    created_at: number;
    feedback?: {
      rating: 'like' | 'dislike';
    };
    retriever_resources: RetrieverResource[];
  }

  interface DifyChatResponse {
    event: string;
    task_id: string;
    id: string;
    message_id: string;
    conversation_id: string;
    mode: string;
    answer: string;
    metadata: {
      usage: Usage;
      retriever_resources: RetrieverResource[];
    };
    created_at: number;
  }
}

export {}