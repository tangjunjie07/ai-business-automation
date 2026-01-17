import argparse
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv


def _repo_root() -> Path:
    # services/ingestion-service/scripts -> repo root
    return Path(__file__).resolve().parents[3]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _as_transactions(ai_or_ocr_result: Dict[str, Any]) -> List[Dict[str, Any]]:
    inferred_accounts = ai_or_ocr_result.get("inferred_accounts") or []
    txs: List[Dict[str, Any]] = []

    for acc in inferred_accounts:
        if not isinstance(acc, dict):
            continue
        txs.append(
            {
                "vendor": acc.get("vendorName") or acc.get("vendor") or "",
                "description": acc.get("description") or "",
                "amount": float(acc.get("amount") or 0),
                "direction": "income" if (acc.get("type") == "income") else "expense",
                "_ref": acc,
            }
        )
    return txs


def _print_results(title: str, txs: List[Dict[str, Any]]) -> None:
    print("\n===", title, "===")
    for i, tx in enumerate(txs, 1):
        vendor = (tx.get("vendor") or "").strip()
        desc = (tx.get("description") or "").strip()
        amount = tx.get("amount")
        direction = tx.get("direction")

        account = tx.get("accountName")
        conf = tx.get("confidence")

        mv_id = tx.get("matched_vendor_id")
        mv_name = tx.get("matched_vendor_name")
        mv_code = tx.get("matched_vendor_code")

        ma_id = tx.get("matched_account_id")
        ma_code = tx.get("matched_account_code")
        ma_name = tx.get("matched_account_name")
        ma_conf = tx.get("account_confidence")

        print(f"\n[{i}] {direction} {amount}")
        print(f"  vendor: {vendor}")
        print(f"  desc  : {desc[:120]}")
        print(f"  -> account: {account} (confidence={conf})")
        print(f"  -> account_match: id={ma_id} code={ma_code} name={ma_name} conf={ma_conf}")
        print(f"  -> vendor_match : id={mv_id} code={mv_code} name={mv_name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Claude master matching on test-data JSON.")
    parser.add_argument(
        "--index",
        type=int,
        default=1,
        help="test-data index (uses test-data/ai_result_{index}.json or ocr_result_{index}.json)",
    )
    parser.add_argument(
        "--source",
        choices=["ai", "ocr"],
        default="ai",
        help="which test-data file to load",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="limit number of transactions (0 = no limit)",
    )
    args = parser.parse_args()

    # Load environment variables from services/ingestion-service/.env (same as app/main.py)
    try:
        load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env")
    except Exception:
        # best-effort: continue even if dotenv loading fails
        pass

    if not os.getenv("ANTHROPIC_API_KEY"):
        print("ERROR: ANTHROPIC_API_KEY is not set in this process environment.")
        print("Set it in the same terminal, e.g. PowerShell:  $env:ANTHROPIC_API_KEY=\"...\"")
        return 2

    repo_root = _repo_root()
    data_path = repo_root / "test-data" / f"{args.source}_result_{args.index}.json"
    if not data_path.exists():
        print(f"ERROR: file not found: {data_path}")
        return 2

    payload = _load_json(data_path)
    if not isinstance(payload, dict):
        print("ERROR: expected a JSON object")
        return 2

    txs = _as_transactions(payload)
    if args.limit and args.limit > 0:
        txs = txs[: args.limit]

    if not txs:
        print("No inferred_accounts -> no transactions to classify.")
        return 0

    # Import here so env var checks happen first
    from app.account_classifier.pipeline import classify_transactions_with_claude

    classified = classify_transactions_with_claude(txs)
    _print_results(str(data_path), classified)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
