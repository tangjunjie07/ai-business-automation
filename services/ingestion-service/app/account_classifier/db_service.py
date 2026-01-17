"""
Claude予測結果とMF仕訳データをDBに保存するサービス (asyncpg版)
services/ingestion-service/app/account_classifier/db_service.py
"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal
import asyncpg

logger = logging.getLogger(__name__)


def _generate_cuid() -> str:
    """Generate a simple CUID-like ID"""
    import uuid
    return f"c{uuid.uuid4().hex[:24]}"


async def _set_rls_tenant(conn: asyncpg.Connection, tenant_id: str) -> None:
    """Set the per-session tenant id for Postgres RLS.

    This is a no-op for schemas without RLS, but is required when RLS policies
    depend on `app.current_tenant_id`.
    """
    await conn.execute("SELECT set_config('app.current_tenant_id', $1, true)", str(tenant_id))


class ClaudePredictionService:
    """Claude予測結果をDBに保存するサービス (asyncpg使用)"""
    
    def __init__(self, db_pool: asyncpg.Pool):
        """
        Args:
            db_pool: asyncpg connection pool
        """
        self.db_pool = db_pool
    
    async def save_prediction(
        self,
        tenant_id: str,
        invoice_id: Optional[str],
        input_data: Dict[str, Any],
        prediction_result: Dict[str, Any],
        status: str = "completed"
    ) -> str:
        """
        Claude予測結果をDBに保存
        
        Args:
            tenant_id: テナントID
            invoice_id: 請求書ID（オプション）
            input_data: 入力データ
            prediction_result: 予測結果
            status: ステータス（completed/failed/pending）
            
        Returns:
            作成されたClaudePredictionのID
        """
        try:
            record_id = _generate_cuid()
            
            async with self.db_pool.acquire() as conn:
                await _set_rls_tenant(conn, tenant_id)
                await conn.execute("""
                    INSERT INTO claude_predictions (
                        id, tenant_id, invoice_id,
                        input_vendor, input_description, input_amount, input_direction,
                        predicted_account, account_confidence, reasoning,
                        matched_account_id, matched_account_code, matched_account_name,
                        matched_vendor_id, matched_vendor_name, vendor_confidence,
                        matched_vendor_code,
                        claude_model, tokens_used, raw_response,
                        status, created_at, updated_at
                    ) VALUES (
                        $1, $2, $3,
                        $4, $5, $6, $7,
                        $8, $9, $10,
                        $11, $12, $13,
                        $14, $15, $16,
                        $17,
                        $18, $19, $20,
                        $21, NOW(), NOW()
                    )
                """,
                    record_id, tenant_id, invoice_id,
                    input_data.get("vendor", ""),
                    input_data.get("description", ""),
                    float(input_data.get("amount", 0)),
                    input_data.get("direction", "expense"),
                    prediction_result.get("account", ""),
                    float(prediction_result.get("confidence", 0)),
                    prediction_result.get("reasoning"),
                    prediction_result.get("matched_account_id"),
                    prediction_result.get("matched_account_code"),
                    prediction_result.get("matched_account_name"),
                    prediction_result.get("matched_vendor_id"),
                    prediction_result.get("matched_vendor_name"),
                    float(prediction_result.get("vendor_confidence")) if prediction_result.get("vendor_confidence") else None,
                    prediction_result.get("matched_vendor_code"),
                    prediction_result.get("model") or "unknown",
                    prediction_result.get("tokens_used"),
                    prediction_result.get("raw_response"),
                    status
                )
            
            logger.info(f"Saved Claude prediction: {record_id}")
            return record_id
            
        except Exception as e:
            logger.exception(f"Failed to save Claude prediction: {e}")
            raise
    
    async def save_failed_prediction(
        self,
        tenant_id: str,
        invoice_id: Optional[str],
        input_data: Dict[str, Any],
        error_message: str
    ) -> str:
        """
        失敗したClaude予測をDBに保存
        
        Args:
            tenant_id: テナントID
            invoice_id: 請求書ID
            input_data: 入力データ
            error_message: エラーメッセージ
            
        Returns:
            作成されたClaudePredictionのID
        """
        try:
            record_id = _generate_cuid()
            
            async with self.db_pool.acquire() as conn:
                await _set_rls_tenant(conn, tenant_id)
                await conn.execute("""
                    INSERT INTO claude_predictions (
                        id, tenant_id, invoice_id,
                        input_vendor, input_description, input_amount, input_direction,
                        predicted_account, account_confidence,
                        claude_model, status, error_message,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3,
                        $4, $5, $6, $7,
                        $8, $9,
                        $10, $11, $12,
                        NOW(), NOW()
                    )
                """,
                    record_id, tenant_id, invoice_id,
                    input_data.get("vendor", ""),
                    input_data.get("description", ""),
                    float(input_data.get("amount", 0)),
                    input_data.get("direction", "expense"),
                    "",
                    0.0,
                    "unknown",
                    "failed",
                    error_message[:500]
                )
            
            logger.warning(f"Saved failed Claude prediction: {record_id}")
            return record_id
            
        except Exception as e:
            logger.exception(f"Failed to save failed prediction: {e}")
            raise


class MfJournalEntryService:
    """Money Forward仕訳データをDBに保存するサービス (asyncpg使用)"""
    
    def __init__(self, db_pool: asyncpg.Pool):
        """
        Args:
            db_pool: asyncpg connection pool
        """
        self.db_pool = db_pool
    
    async def save_journal_entry(
        self,
        tenant_id: str,
        journal_data: Dict[str, Any],
        claude_prediction_id: Optional[str] = None
    ) -> str:
        """
        MF仕訳データをDBに保存
        
        Args:
            tenant_id: テナントID
            journal_data: 仕訳データ
            claude_prediction_id: 関連するClaude予測ID
            
        Returns:
            作成されたMfJournalEntryのID
        """
        try:
            # transaction_dateをdatetimeに変換
            transaction_date = journal_data.get("transaction_date")
            if isinstance(transaction_date, str):
                transaction_date = datetime.fromisoformat(transaction_date)
            
            record_id = _generate_cuid()
            
            async with self.db_pool.acquire() as conn:
                await _set_rls_tenant(conn, tenant_id)
                await conn.execute("""
                    INSERT INTO mf_journal_entries (
                        id, tenant_id, claude_prediction_id,
                        transaction_date, transaction_type,
                        income_amount, expense_amount,
                        account_subject, vendor, description,
                        matched_account_id, matched_account_code,
                        matched_vendor_id, matched_vendor_code,
                        account_book, tax_category, memo, tag_names,
                        status, csv_exported, mf_imported,
                        created_at, updated_at
                    ) VALUES (
                        $1, $2, $3,
                        $4, $5,
                        $6, $7,
                        $8, $9, $10,
                        $11, $12,
                        $13, $14,
                        $15, $16, $17, $18,
                        $19, $20, $21,
                        NOW(), NOW()
                    )
                """,
                    record_id, tenant_id, claude_prediction_id,
                    transaction_date,
                    journal_data.get("transaction_type", "支出"),
                    journal_data.get("income_amount"),
                    journal_data.get("expense_amount"),
                    journal_data.get("account_subject", ""),
                    journal_data.get("vendor"),
                    journal_data.get("description"),
                    journal_data.get("matched_account_id"),
                    journal_data.get("matched_account_code"),
                    journal_data.get("matched_vendor_id"),
                    journal_data.get("matched_vendor_code"),
                    journal_data.get("account_book"),
                    journal_data.get("tax_category"),
                    journal_data.get("memo"),
                    journal_data.get("tag_names"),
                    "draft",
                    False,
                    False
                )
            
            logger.info(f"Saved MF journal entry: {record_id}")
            return record_id
            
        except Exception as e:
            logger.exception(f"Failed to save MF journal entry: {e}")
            raise
    
    async def save_batch_journal_entries(
        self,
        tenant_id: str,
        journal_entries: List[Dict[str, Any]],
        claude_prediction_ids: Optional[List[str]] = None
    ) -> List[str]:
        """
        複数のMF仕訳データを一括保存
        
        Args:
            tenant_id: テナントID
            journal_entries: 仕訳データのリスト
            claude_prediction_ids: Claude予測IDのリスト
            
        Returns:
            作成されたMfJournalEntryのIDリスト
        """
        created_ids = []
        
        for idx, journal_data in enumerate(journal_entries):
            claude_id = None
            if claude_prediction_ids and idx < len(claude_prediction_ids):
                claude_id = claude_prediction_ids[idx]
            
            try:
                entry_id = await self.save_journal_entry(
                    tenant_id=tenant_id,
                    journal_data=journal_data,
                    claude_prediction_id=claude_id
                )
                created_ids.append(entry_id)
            except Exception as e:
                logger.error(f"Failed to save journal entry {idx}: {e}")
                continue
        
        logger.info(f"Saved {len(created_ids)}/{len(journal_entries)} MF journal entries")
        return created_ids
    
    async def mark_as_exported(self, entry_id: str) -> None:
        """
        仕訳をCSV出力済みとしてマーク
        
        Args:
            entry_id: MfJournalEntryのID
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE mf_journal_entries
                SET csv_exported = TRUE,
                    csv_exported_at = NOW(),
                    status = 'exported',
                    updated_at = NOW()
                WHERE id = $1
            """, entry_id)
        logger.info(f"Marked journal entry {entry_id} as exported")
    
    async def mark_as_imported(
        self,
        entry_id: str,
        mf_journal_id: Optional[str] = None
    ) -> None:
        """
        仕訳をMFインポート済みとしてマーク
        
        Args:
            entry_id: MfJournalEntryのID
            mf_journal_id: MF側の仕訳ID
        """
        async with self.db_pool.acquire() as conn:
            await conn.execute("""
                UPDATE mf_journal_entries
                SET mf_imported = TRUE,
                    mf_imported_at = NOW(),
                    mf_journal_id = $2,
                    status = 'imported',
                    updated_at = NOW()
                WHERE id = $1
            """, entry_id, mf_journal_id)
        logger.info(f"Marked journal entry {entry_id} as imported")
    
    async def get_unexported_entries(self, tenant_id: str) -> List[Dict[str, Any]]:
        """
        未出力の仕訳データを取得
        
        Args:
            tenant_id: テナントID
            
        Returns:
            未出力の仕訳データリスト
        """
        async with self.db_pool.acquire() as conn:
            await _set_rls_tenant(conn, tenant_id)
            rows = await conn.fetch("""
                SELECT *
                FROM mf_journal_entries
                WHERE tenant_id = $1
                  AND csv_exported = FALSE
                  AND status IN ('draft', 'ready')
                ORDER BY transaction_date ASC
            """, tenant_id)
        
        entries = [dict(row) for row in rows]
        logger.info(f"Found {len(entries)} unexported entries for tenant {tenant_id}")
        return entries


# ヘルパー関数
def convert_transaction_to_journal_data(
    tx: Dict[str, Any],
    transaction_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    取引データをMF仕訳フォーマットに変換
    
    Args:
        tx: 取引データ
        transaction_date: 取引日（指定しない場合は現在日時）
        
    Returns:
        MF仕訳フォーマットのデータ
    """
    if transaction_date is None:
        transaction_date = datetime.now()
    
    direction = tx.get("direction", "expense")
    amount = float(tx.get("amount", 0))
    
    return {
        "transaction_date": transaction_date,
        "transaction_type": "収入" if direction == "income" else "支出",
        "income_amount": amount if direction == "income" else None,
        "expense_amount": amount if direction == "expense" else None,
        "account_subject": tx.get("accountName", ""),
        # マスタ照合結果（任意）
        "matched_account_id": tx.get("matched_account_id"),
        "matched_account_code": tx.get("matched_account_code"),
        "vendor": tx.get("matched_vendor_name") or tx.get("vendor"),
        "matched_vendor_id": tx.get("matched_vendor_id"),
        "matched_vendor_code": tx.get("matched_vendor_code"),
        "description": tx.get("description", ""),
        "account_book": None,
        "tax_category": None,
        "memo": tx.get("reasoning"),
        "tag_names": None,
    }
