from __future__ import annotations

from typing import Any, Dict, List, Optional


def extract_transactions_from_inferred_accounts(
    inferred_accounts: Optional[List[Dict[str, Any]]],
    ocr_data: Optional[Dict[str, Any]] = None,
    file_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Extract flat transaction rows from inferred_accounts structure.

    The existing AI inference output is typically a list of items like:
      { summary: str, invoiceDate: str, accounting: [ {date, amount, accountItem, subAccountItem, ...}, ... ] }

    This function normalizes that into a flat list of dicts the exporter can consume.
    """
    inferred_accounts = inferred_accounts or []
    vendor = None
    if isinstance(ocr_data, dict):
        vendor = (
            ocr_data.get("vendor")
            or ocr_data.get("vendor_name")
            or ocr_data.get("VendorName")
            or ocr_data.get("merchant")
        )

    txs: List[Dict[str, Any]] = []
    for ia in inferred_accounts:
        if not isinstance(ia, dict):
            continue

        summary = ia.get("summary")
        invoice_date = ia.get("invoiceDate") or ia.get("date")
        accounting = ia.get("accounting")
        if not isinstance(accounting, list):
            continue

        for a in accounting:
            if not isinstance(a, dict):
                continue

            date = a.get("date") or invoice_date
            amount = a.get("amount")
            desc = a.get("subAccountItem") or a.get("sub_account") or summary or "（摘要なし）"

            txs.append(
                {
                    "date": date,
                    "vendor": vendor,
                    "description": desc,
                    "amount": amount,
                    "direction": "expense",
                    "accountName": a.get("accountItem") or a.get("accountName") or "",
                    "confidence": a.get("confidence"),
                    "reasoning": a.get("reasoning"),
                    "fileName": file_name,
                    # keep reference so caller can write back prediction to original structure if needed
                    "_ref": a,
                }
            )
    return txs
