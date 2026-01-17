"""Pipeline + Claude 精度チェック用スクリプト（ローカル実行）

このスクリプトは、`test-data/ai_result_*.json`（inferred_accounts 形式）を入力として
account_classifier のパイプライン（正規化→Claude分類→(任意)CSV生成→(任意)DB保存）を走らせ、
各取引の expected（入力側 accountItem）と predicted（Claude 推定）を並べて確認できます。

Examples:
  # ルートの test-data を一括で回す（.env を読む）
  python services/ingestion-service/scripts/run_pipeline_debug.py

  # vendor を強制指定（test-data に vendor が無いケース向け）
  python services/ingestion-service/scripts/run_pipeline_debug.py --default-vendor Amazon

  # DB に保存する（TENANT_ID が必要）
  python services/ingestion-service/scripts/run_pipeline_debug.py --persist-db --tenant-id <uuid>
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple


# `services/ingestion-service` 配下の `app/` を import できるようにする
_SERVICE_ROOT = Path(__file__).resolve().parents[1]
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))


def _repo_root() -> Path:
    # .../services/ingestion-service/scripts/run_pipeline_debug.py
    # parents[0]=scripts, [1]=ingestion-service, [2]=services, [3]=repo root
    return Path(__file__).resolve().parents[3]


def _load_dotenv_if_available(dotenv_path: Path) -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(dotenv_path)
    except Exception:
        # dotenv は必須ではない（環境変数で渡しても良い）
        return


def _flatten_expected_from_inferred_accounts(inferred_accounts: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    expected: List[Dict[str, Any]] = []
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
            expected.append(
                {
                    "date": a.get("date") or invoice_date,
                    "amount": a.get("amount"),
                    "expected_account": a.get("accountItem") or a.get("accountName") or "",
                    "expected_confidence": a.get("confidence"),
                    "expected_reasoning": a.get("reasoning"),
                    "expected_description": a.get("subAccountItem") or a.get("sub_account") or summary or "（摘要なし）",
                }
            )
    return expected


def _load_ai_result(path: Path) -> Tuple[List[Dict[str, Any]], Dict[str, Any], str]:
    obj = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(obj, dict):
        raise ValueError(f"Invalid JSON object in {path}")

    inferred_accounts = obj.get("inferred_accounts") or obj.get("inferredAccounts") or []
    if not isinstance(inferred_accounts, list):
        raise ValueError(f"inferred_accounts must be a list in {path}")

    file_name = obj.get("file_name") or obj.get("fileName") or path.name
    ocr_data: Dict[str, Any] = {}
    if isinstance(obj.get("ocr_data"), dict):
        ocr_data = dict(obj["ocr_data"])
    return inferred_accounts, ocr_data, str(file_name)


@dataclass
class RunResult:
    file: str
    total: int
    exact_match: int
    with_vendor_match: int
    errors: List[str]


async def _run_one(
    *,
    input_path: Path,
    default_vendor: Optional[str],
    generate_csv: bool,
    show_csv: bool,
    persist_db: bool,
    tenant_id: Optional[str],
    invoice_id: Optional[str],
) -> RunResult:
    from app.account_classifier.pipeline import run_account_classifier

    inferred_accounts, ocr_data, file_name = _load_ai_result(input_path)

    # 期待値（Claude が書き戻して壊してもよいように、先に flatten して保持）
    expected_rows = _flatten_expected_from_inferred_accounts(inferred_accounts)

    # pipeline 側は in-place 更新をするので deep copy して渡す
    inferred_copy = copy.deepcopy(inferred_accounts)

    if default_vendor and not ocr_data.get("vendor"):
        ocr_data["vendor"] = default_vendor

    db_pool = None
    if persist_db:
        if not tenant_id:
            raise ValueError("--tenant-id is required when --persist-db is set")
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL is required when --persist-db is set")

        import asyncpg

        db_pool = await asyncpg.create_pool(database_url)

    try:
        result = await run_account_classifier(
            inferred_accounts=inferred_copy,
            ocr_data=ocr_data,
            file_name=file_name,
            generate_mf_csv=generate_csv,
            persist_db=persist_db,
            db_pool=db_pool,
            tenant_id=tenant_id,
            invoice_id=invoice_id,
        )
    finally:
        if db_pool is not None:
            await db_pool.close()

    txs = result.transactions
    total = len(txs)

    # expected と predicted を同じ順序で比較（ズレたら key で合わせる）
    exact_match = 0
    with_vendor_match = 0

    if len(expected_rows) == total:
        pairs = list(zip(expected_rows, txs))
    else:
        # フォールバック: (date, amount, description) で突合
        expected_map: Dict[Tuple[Any, Any, Any], Dict[str, Any]] = {}
        for e in expected_rows:
            key = (e.get("date"), e.get("amount"), e.get("expected_description"))
            expected_map[key] = e
        pairs = []
        for tx in txs:
            key = (tx.get("date"), tx.get("amount"), tx.get("description"))
            pairs.append((expected_map.get(key, {}), tx))

    print("\n" + "=" * 88)
    print(f"FILE: {input_path.name}  (file_name={file_name})")
    print(f"vendor(ocr_data)={ocr_data.get('vendor')}")
    print("-" * 88)

    for idx, (exp, tx) in enumerate(pairs, 1):
        exp_account = (exp.get("expected_account") or "").strip()
        pred_account = (tx.get("accountName") or "").strip()
        if exp_account and pred_account and exp_account == pred_account:
            exact_match += 1

        if tx.get("matched_vendor_id"):
            with_vendor_match += 1

        print(
            f"[{idx:02d}] amount={tx.get('amount')} date={tx.get('date')}\n"
            f"  desc: {tx.get('description')}\n"
            f"  expected: {exp_account}\n"
            f"  predicted: {pred_account} (conf={tx.get('confidence')}, model={tx.get('claude_model')}, toks={tx.get('claude_tokens_used')})\n"
            f"  account_match: code={tx.get('matched_account_code')} name={tx.get('matched_account_name')} conf={tx.get('account_confidence')}\n"
            f"  vendor_match: id={tx.get('matched_vendor_id')} name={tx.get('matched_vendor_name')} conf={tx.get('vendor_confidence')}\n"
        )

    print("-" * 88)
    if total:
        print(f"Exact accountName match: {exact_match}/{total} ({(exact_match/total)*100:.1f}%)")
        print(f"Vendor matched (id present): {with_vendor_match}/{total} ({(with_vendor_match/total)*100:.1f}%)")
    if persist_db:
        print(f"Persisted to DB: {result.persisted_count}")
    if result.errors:
        print(f"Pipeline errors: {result.errors}")
    print("=" * 88)

    if show_csv and result.mf_csv:
        print("\n--- MF CSV (preview) ---")
        print(result.mf_csv)

    return RunResult(
        file=str(input_path),
        total=total,
        exact_match=exact_match,
        with_vendor_match=with_vendor_match,
        errors=result.errors,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Run account_classifier pipeline against test-data ai_result JSON")
    parser.add_argument(
        "--glob",
        default="test-data/ai_result_*.json",
        help="Glob pattern (relative to repo root) for input JSON files",
    )
    parser.add_argument(
        "--file",
        action="append",
        default=None,
        help="Explicit input file path (can be specified multiple times)",
    )
    parser.add_argument("--limit", type=int, default=0, help="Limit number of files")
    parser.add_argument("--default-vendor", default=None, help="Set ocr_data.vendor if missing")
    parser.add_argument("--no-csv", action="store_true", help="Do not generate MF CSV")
    parser.add_argument("--show-csv", action="store_true", help="Print MF CSV")
    parser.add_argument("--persist-db", action="store_true", help="Persist results to DB (requires DATABASE_URL + tenant)")
    parser.add_argument("--tenant-id", default=os.getenv("TENANT_ID"), help="Tenant ID for RLS (or env TENANT_ID)")
    parser.add_argument("--invoice-id", default=None, help="Optional invoice ID (must exist if FK enforced)")

    args = parser.parse_args()

    repo_root = _repo_root()
    dotenv_path = repo_root / "services" / "ingestion-service" / ".env"
    if dotenv_path.exists():
        _load_dotenv_if_available(dotenv_path)

    input_paths: List[Path] = []
    if args.file:
        for f in args.file:
            # まずはそのまま解決（CWD 相対）し、存在しなければ repo root 相対も試す
            p = Path(f)
            if not p.is_absolute():
                p_local = (Path.cwd() / p).resolve()
                if p_local.exists():
                    p = p_local
                else:
                    p = (repo_root / p).resolve()
            input_paths.append(p)
    else:
        input_paths = sorted((repo_root / args.glob).parent.glob(Path(args.glob).name))
        # args.glob がディレクトリを含む場合への対応
        if not input_paths:
            input_paths = sorted(repo_root.glob(args.glob))

    input_paths = [p for p in input_paths if p.exists()]
    if args.limit and args.limit > 0:
        input_paths = input_paths[: args.limit]

    if not input_paths:
        if args.file:
            raise SystemExit(f"No input files found (--file={args.file})")
        raise SystemExit(f"No input files found (glob={args.glob})")

    async def runner() -> None:
        summary_total = 0
        summary_exact = 0
        summary_vendor = 0
        summary_errors: List[str] = []

        for p in input_paths:
            r = await _run_one(
                input_path=p,
                default_vendor=args.default_vendor,
                generate_csv=not args.no_csv,
                show_csv=args.show_csv,
                persist_db=args.persist_db,
                tenant_id=args.tenant_id,
                invoice_id=args.invoice_id,
            )
            summary_total += r.total
            summary_exact += r.exact_match
            summary_vendor += r.with_vendor_match
            summary_errors.extend(r.errors or [])

        print("\n" + "#" * 88)
        print("SUMMARY")
        print(f"Files: {len(input_paths)}")
        if summary_total:
            print(f"Exact accountName match: {summary_exact}/{summary_total} ({(summary_exact/summary_total)*100:.1f}%)")
            print(f"Vendor matched (id present): {summary_vendor}/{summary_total} ({(summary_vendor/summary_total)*100:.1f}%)")
        if summary_errors:
            print(f"Errors (unique): {sorted(set(summary_errors))}")
        print("#" * 88)

    asyncio.run(runner())


if __name__ == "__main__":
    main()
