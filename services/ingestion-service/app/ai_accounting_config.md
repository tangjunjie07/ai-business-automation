# Master Data for AI Accounting Automation

## Account Subjects
勘定科目と関連キーワードのマッピング。

- 支払手数料: 振込手数料、システム利用料、仲介手数料
- 外注費: 協力会社への業務委託、技術者派遣
- 通信費: NTT、インターネット回線、携帯代
- 水道光熱費: 電気、ガス、水道代
- 法定福利費: 住民税、社会保険料（会社負担分）
- 福利厚生費: 社内イベント、慶弔見舞金

## Rules
勘定科目推論のルール。

- NTTなら通信費
- 協力会社なら外注費
- 金額が大きい場合は確認が必要

## Output Format
AI推論の出力JSONフォーマット。

```json
{
  "totalAmount": 0,
  "invoiceDate": "YYYY-MM-DD",
  "currency": "JPY",
  "projectId": "プロジェクトコード",
  "accounting": [
    {
      "accountItem": "勘定科目名",
      "subAccountItem": "補助科目名",
      "amount": 0,
      "date": "YYYY-MM-DD",
      "confidence": 0.0,
      "reasoning": "なぜその科目を選んだかの理由",
      "is_anomaly": false
    }
  ],
  "summary": "仕訳の要約や注記（任意）"
}
```

注意: フロントエンドとバックエンドの `ai_result` 構造に合わせて上記フィールドを返すことを想定しています。AIは必ず上記のJSON構造に従って出力してください。