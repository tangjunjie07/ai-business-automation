"""
Master データローダー
services/ingestion-service/app/account_classifier/master_loader.py

各種マスタデータを設定ファイルから読み込むユーティリティ
"""
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from functools import lru_cache

logger = logging.getLogger(__name__)


@dataclass
class MasterConfig:
    """Master データの設定"""
    masters_dir: Path
    
    def __post_init__(self):
        if isinstance(self.masters_dir, str):
            self.masters_dir = Path(self.masters_dir)
        
        if not self.masters_dir.exists():
            raise ValueError(f"Masters directory not found: {self.masters_dir}")


class MasterLoader:
    """Master データを設定ファイルから読み込むクラス"""
    
    DEFAULT_MASTERS_DIR = Path(__file__).parent / "masters"
    
    def __init__(self, masters_dir: Optional[Path] = None):
        """
        Args:
            masters_dir: マスタファイルが格納されているディレクトリ
                        None の場合はデフォルトパスを使用
        """
        if masters_dir is None:
            # 環境変数から取得を試みる
            env_path = os.getenv("MASTERS_CONFIG_DIR")
            if env_path:
                masters_dir = Path(env_path)
            else:
                masters_dir = self.DEFAULT_MASTERS_DIR
        
        self.config = MasterConfig(masters_dir=masters_dir)
        logger.info(f"MasterLoader initialized with directory: {self.config.masters_dir}")
    
    @lru_cache(maxsize=1)
    def load_account_masters(self) -> List[Dict[str, Any]]:
        """
        勘定科目マスタを読み込む
        
        Returns:
            勘定科目のリスト
        """
        file_path = self.config.masters_dir / "account_masters.json"
        return self._load_json_file(file_path, "account_masters")
    
    @lru_cache(maxsize=1)
    def load_vendor_masters(self, active_only: bool = True) -> List[Dict[str, Any]]:
        """
        取引先マスタを読み込む
        
        Args:
            active_only: Trueの場合、activeフラグがTrueのもののみ返す
            
        Returns:
            取引先のリスト
        """
        file_path = self.config.masters_dir / "vendor_masters.json"
        vendors = self._load_json_file(file_path, "vendor_masters")
        
        if active_only:
            vendors = [v for v in vendors if v.get("active", True)]
            logger.debug(f"Filtered to {len(vendors)} active vendors")
        
        return vendors
    
    def _load_json_file(self, file_path: Path, master_name: str) -> List[Dict[str, Any]]:
        """
        JSONファイルを読み込む
        
        Args:
            file_path: ファイルパス
            master_name: マスタ名（ログ用）
            
        Returns:
            パースされたJSON（リスト）
        """
        try:
            if not file_path.exists():
                logger.warning(f"{master_name} file not found: {file_path}")
                return []
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if not isinstance(data, list):
                logger.error(f"{master_name} must be a JSON array, got {type(data)}")
                return []
            
            logger.info(f"Loaded {len(data)} records from {master_name}")
            return data
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse {master_name} JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to load {master_name}: {e}")
            return []
    
    def get_account_names(self) -> List[str]:
        """
        勘定科目名のリストを取得
        
        Returns:
            勘定科目名のリスト
        """
        accounts = self.load_account_masters()
        return [acc["name"] for acc in accounts if "name" in acc]
    
    def get_vendors_for_claude(self) -> List[Dict[str, str]]:
        """
        Claude APIに渡すための簡易版取引先リストを取得
        
        Returns:
            {id, name}のみを含むリスト
        """
        vendors = self.load_vendor_masters(active_only=True)
        return [
            {"id": v["id"], "name": v["name"]}
            for v in vendors
            if "id" in v and "name" in v
        ]
    
    def reload(self):
        """
        キャッシュをクリアして再読み込み
        
        マスタファイルが更新された場合に呼び出す
        """
        logger.info("Reloading all masters...")
        self.load_account_masters.cache_clear()
        self.load_vendor_masters.cache_clear()
        logger.info("Masters reloaded")


# グローバルインスタンス（シングルトンパターン）
_global_loader: Optional[MasterLoader] = None


def get_master_loader(masters_dir: Optional[Path] = None) -> MasterLoader:
    """
    グローバルなMasterLoaderインスタンスを取得
    
    Args:
        masters_dir: 初回呼び出し時のみ使用されるディレクトリパス
        
    Returns:
        MasterLoaderインスタンス
    """
    global _global_loader
    
    if _global_loader is None:
        _global_loader = MasterLoader(masters_dir=masters_dir)
    
    return _global_loader


def reload_masters():
    """
    グローバルなマスタデータを再読み込み
    
    アプリケーション実行中にマスタファイルが更新された場合に使用
    """
    global _global_loader
    
    if _global_loader is not None:
        _global_loader.reload()
    else:
        logger.warning("MasterLoader not initialized yet")
