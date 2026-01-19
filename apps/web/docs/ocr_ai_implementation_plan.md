# 実装プラン: OCR項目の勘定科目推論のためのGPT-4プロンプトエンジニアリング

現在のプロジェクト（ai-business-automation）を理解した上で、OCRで読み取った請求書項目（例: 品目名、金額）を勘定科目に振り分けるためのGPT-4プロンプトを作成する実装プランを以下にまとめます。プロジェクトはFastAPIベースのマイクロサービスアーキテクチャで、マルチテナント対応（PostgreSQL RLS）されており、ingestion-serviceがファイルアップロードとOCR処理を担っています。技術設計書ではAzure Document IntelligenceをOCRの主力とし、補完としてLangChain + OpenAI GPT-4 Visionを使用することが指定されています。

## 1. 全体設計と要件
- **目標**: OCRで抽出された請求書データ（例: 品目、金額）をGPT-4に渡し、日本の会計基準に基づいて勘定科目（例: "消耗品費"、"旅費交通費"）を推論。結果をDB（ocr_resultsテーブルのextractedフィールド）に保存。
- **入力**: Azure Document Intelligenceからの抽出データ（JSON形式、例: {"vendor": "VendorName", "items": [{"description": "会議室レンタル", "amount": 5000}]}）。
- **出力**: 各項目に勘定科目を付与したJSON（例: [{"item": "会議室レンタル", "amount": 5000, "account": "会議費"}]）。
- **技術スタック**: LangChainでOpenAI GPT-4 APIを呼び出し。Visionモデルはテキスト推論にも対応可能。
- **統合ポイント**: ingestion-serviceのアップロードエンドポイント（main.py）でOCR処理をトリガー。非同期処理（Celery/Kafka推奨）を考慮し、即時レスポンスを避ける。
- **マルチテナント対応**: テナントIDを考慮し、推論ロジックに拠点固有のルールを追加可能（例: マレーシア拠点の勘定科目マッピング）。

## 2. 依存関係の更新
現在のrequirements.txtにLangChainとOpenAI関連ライブラリが含まれていないため、追加します。
- 更新内容: requirements.txtに以下の行を追加。
  ```
  langchain
  langchain-openai
  openai
  ```
- 理由: LangChainでプロンプト管理とAPI呼び出しを簡素化。OpenAIライブラリでGPT-4アクセス。
- 実行: `pip install langchain langchain-openai openai` でインストール後、requirements.txtを更新。

## 3. 新しいモジュールの作成
- **ファイル**: services/ingestion-service/app/ocr_ai.py（新規作成）。
- **役割**: Azure Document IntelligenceでOCRを実行し、結果をGPT-4に渡して勘定科目推論。
- **実装概要**:
  - Azure SDKでOCR処理。
  - LangChainのPromptTemplateとChatOpenAIでプロンプト実行。
  - 結果を構造化JSONで返す。
- **コード例**（ocr_ai.pyの抜粋）:
  ```python
  from langchain.prompts import PromptTemplate
  from langchain_openai import ChatOpenAI
  from azure.ai.formrecognizer import DocumentAnalysisClient
  from azure.core.credentials import AzureKeyCredential
  import os
  import json

  # Azure Document Intelligence設定
  AZURE_ENDPOINT = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
  AZURE_KEY = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

  # OpenAI設定
  OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

  # プロンプトテンプレート（バックエンドからGPT-4 APIへ送る指示書）
  SYSTEM_PROMPT = """
  # Role
  あなたは高度な専門知識を持つプロの経理担当AIです。
  提供された請求書データに基づき、最も適切な「勘定科目」と「補助科目」を特定し、仕訳データを作成してください。

  # Constraints
  - 出力は必ず指定されたJSON形式で行うこと。
  - 会社独自のプロジェクトコード体系を考慮すること。
  - 確信が持てない場合は、confidenceスコアを低く設定し、理由を明記すること。

  # Master Data (勘定科目リスト)
  - 支払手数料: 振込手数料、システム利用料、仲介手数料
  - 外注費: 協力会社への業務委託、技術者派遣
  - 通信費: NTT、インターネット回線、携帯代
  - 水道光熱費: 電気、ガス、水道代
  - 法定福利費: 住民税、社会保険料（会社負担分）
  - 福利厚生費: 社内イベント、慶弔見舞金

  # Input Data
  {{ocr_extracted_json}}

  # Output Format (JSON)
  {
    "account_item": "勘定科目名",
    "sub_account_item": "補助科目名",
    "confidence": 0.0 ~ 1.0,
    "reasoning": "なぜその科目を選んだかの理由",
    "is_anomaly": true/false (過去の傾向や金額から見て異常か)
  }
  """

  USER_PROMPT_TEMPLATE = """
  請求書データ: {ocr_data}
  項目リスト: {items}
  """

  prompt = PromptTemplate(
      input_variables=["ocr_data", "items"],
      template=USER_PROMPT_TEMPLATE
  )

  llm = ChatOpenAI(model="gpt-4", temperature=0, openai_api_key=OPENAI_API_KEY)

  async def analyze_document(file_url: str) -> dict:
      # Azure OCR処理
      client = DocumentAnalysisClient(endpoint=AZURE_ENDPOINT, credential=AzureKeyCredential(AZURE_KEY))
      poller = client.begin_analyze_document_from_url("prebuilt-invoice", file_url)
      result = poller.result()
      
      # 抽出データ構築（簡易例）
      ocr_data = {}
      items = []
      for doc in result.documents:
          vendor = doc.fields.get("VendorName")
          if vendor:
              ocr_data["vendor"] = vendor.value
          invoice_items = doc.fields.get("Items")
          if invoice_items:
              for item in invoice_items.value:
                  desc = item.get("Description")
                  amt = item.get("Amount")
                  if desc and amt:
                      items.append({"description": desc.value, "amount": amt.value})
      
      # GPT-4推論
      if items:
          chain = prompt | llm
          response = chain.invoke({"ocr_data": json.dumps(ocr_data), "items": json.dumps(items)})
          # 応答をJSONパース（LangChainのStructuredOutputParser使用推奨）
          inferred_accounts = json.loads(response.content)
          return {"ocr_data": ocr_data, "inferred_accounts": inferred_accounts}
      return {"ocr_data": ocr_data, "inferred_accounts": []}
  ```
- **注意**: Visionモデルを使用する場合、画像URLを直接渡すようプロンプトを調整（例: GPT-4 Visionで画像分析）。

## 4. プロンプトエンジニアリングの詳細
- **システムプロンプト**: 会計士役を指定し、日本の基準を強調。出力形式をJSONに固定してパースしやすくする。
- **ユーザー入力**: OCR抽出データを構造化して渡す。例: 全体のベンダー情報 + 項目リスト。
- **調整ポイント**:
  - 拠点固有: テナントIDに基づき、プロンプトに「マレーシア拠点の場合、XX勘定を使用」と追加。
  - 精度向上: Few-shot例を追加（例: "会議室レンタル → 会議費"）。
  - エラー処理: GPT-4の応答がJSONでない場合、デフォルト勘定を使用。
- **テスト**: サンプルデータでプロンプトを検証。例: 入力 {"items": [{"description": "タクシー代", "amount": 3000}]} → 出力 {"account": "旅費交通費"}。

## 5. 統合とワークフロー更新
- **main.pyの更新**: upload_invoiceエンドポイントでocr_ai.analyze_documentを呼び出し、結果をocr_results.extractedに保存。
  - 非同期化: Celeryタスクとして実装（技術設計書参照）。
- **DB更新**: extractedフィールドに"inferred_accounts"を追加。
- **環境変数**: AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT, AZURE_DOCUMENT_INTELLIGENCE_KEY, OPENAI_API_KEYを追加。

## 6. テストと検証
- **ユニットテスト**: ocr_ai.pyにテスト関数を追加。モックデータでGPT-4応答を検証。
- **統合テスト**: サンプルPDFをアップロードし、DBに正しい勘定科目が保存されるか確認。
- **精度評価**: 実際の請求書でテストし、必要に応じてプロンプトをチューニング（例: より詳細な指示追加）。
- **ビルド/テスト実行**: `python -m pytest` でテスト。FastAPIの/healthエンドポイントでサービス稼働確認。

## 7. リスクと考慮事項
- **コスト**: OpenAI API使用で料金発生。Azureとのハイブリッド使用でコスト最適化。
- **セキュリティ**: APIキーを環境変数で管理。RLSでテナント分離を維持。
- **スケーラビリティ**: 非同期処理で負荷分散。技術設計書のKafka/Celeryを活用。
- **拡張**: 将来的にVisionモデルで画像直接分析を追加。

このプランで実装を開始できます。必要に応じて具体的なコード生成やファイル編集を依頼してください。

## 完了マーク
✅ 実装プランをdocsフォルダに配置完了。プロンプト例を統合済み。</content>
<parameter name="filePath">/Users/junjietang/Projects/ai-business-automation/docs/ocr_ai_implementation_plan.md