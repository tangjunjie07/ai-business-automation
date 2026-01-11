import os
import asyncio
import logging
from typing import Optional, Union
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)


class StorageError(Exception):
    """Custom exception for storage-related errors."""
    def __init__(self, message: str, original_error: Optional[Exception] = None):
        super().__init__(message)
        self.original_error = original_error


from abc import ABC, abstractmethod

class BaseStorage(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    async def save(self, filename: str, data: bytes) -> str:
        """
        Save file data and return the URL.

        Args:
            filename: Name/key of the file to save.
            data: File content as bytes.

        Returns:
            URL or path where the file is accessible.

        Raises:
            StorageError: If save operation fails.
        """
        pass


class LocalStorage(BaseStorage):
    """Local filesystem storage implementation."""

    def __init__(self, base_path: Optional[Union[str, Path]] = None):
        self.base_path = Path(base_path or os.getenv("LOCAL_STORAGE_PATH", "/tmp/aba_files"))

        try:
            self.base_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Local storage initialized at {self.base_path}")
        except OSError as e:
            logger.error(f"Failed to create local storage directory: {e}")
            raise StorageError(f"Local storage setup failed: {e}", e)

    async def save(self, filename: str, data: bytes) -> str:
        """
        Save file to local filesystem.

        Args:
            filename: Relative path within storage directory.
            data: File content.

        Returns:
            Absolute path to saved file.

        Raises:
            StorageError: If save fails.
        """
        if not data:
            raise StorageError("Cannot save empty data")

        file_path = self.base_path / filename

        try:
            # Ensure parent directories exist
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file asynchronously
            await asyncio.to_thread(file_path.write_bytes, data)

            logger.info(f"File saved locally: {file_path}")
            return str(file_path)

        except Exception as e:
            logger.error(f"Failed to save file locally {file_path}: {e}")
            raise StorageError(f"Local save failed: {e}", e)


class S3Storage(BaseStorage):
    """Amazon S3 storage implementation."""

    def __init__(self):
        self.bucket = os.getenv("S3_BUCKET")
        if not self.bucket:
            raise StorageError("S3_BUCKET environment variable not set")

        try:
            import boto3
            session = boto3.session.Session()
            self.client = session.client("s3")
            logger.info(f"S3 storage initialized for bucket {self.bucket}")
        except ImportError as e:
            raise StorageError("boto3 not installed", e)
        except Exception as e:
            logger.error(f"S3 client initialization failed: {e}")
            raise StorageError(f"S3 setup failed: {e}", e)

    async def save(self, filename: str, data: bytes) -> str:
        """
        Save file to S3 bucket.

        Args:
            filename: S3 object key.
            data: File content.

        Returns:
            S3 URL of saved file.

        Raises:
            StorageError: If upload fails.
        """
        if not data:
            raise StorageError("Cannot save empty data")

        try:
            await asyncio.get_event_loop().run_in_executor(
                None, self.client.put_object, {
                    'Bucket': self.bucket,
                    'Key': filename,
                    'Body': data
                }
            )
            url = f"s3://{self.bucket}/{filename}"
            logger.info(f"File saved to S3: {url}")
            return url

        except Exception as e:
            logger.error(f"Failed to save file to S3 {filename}: {e}")
            raise StorageError(f"S3 save failed: {e}", e)


class AzureBlobStorage(BaseStorage):
    """Azure Blob Storage implementation."""

    def __init__(self):
        conn_str = os.getenv("AZURE_BLOB_CONNECTION_STRING")
        self.container = os.getenv("AZURE_BLOB_CONTAINER")

        if not conn_str or not self.container:
            raise StorageError("Azure Blob storage credentials not configured")

        try:
            from azure.storage.blob import BlobServiceClient
            self.client = BlobServiceClient.from_connection_string(conn_str)
            logger.info(f"Azure Blob storage initialized for container {self.container}")
        except ImportError as e:
            raise StorageError("azure-storage-blob not installed", e)
        except Exception as e:
            logger.error(f"Azure Blob client initialization failed: {e}")
            raise StorageError(f"Azure setup failed: {e}", e)

    async def save(self, filename: str, data: bytes) -> str:
        """
        Save file to Azure Blob Storage with SAS token.

        Args:
            filename: Blob name.
            data: File content.

        Returns:
            Blob URL with SAS token for read access.

        Raises:
            StorageError: If upload fails.
        """
        if not data:
            raise StorageError("Cannot save empty data")

        try:
            from azure.storage.blob import BlobSasPermissions, generate_blob_sas
            from datetime import datetime, timedelta

            container_client = self.client.get_container_client(self.container)
            blob_client = container_client.get_blob_client(filename)

            # Upload blob
            await asyncio.to_thread(blob_client.upload_blob, data, overwrite=True)

            # Generate SAS token for read access (1 hour expiry)
            sas_token = generate_blob_sas(
                account_name=self.client.account_name,
                container_name=self.container,
                blob_name=filename,
                account_key=self.client.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=1)
            )

            # Return URL with SAS token
            url = f"https://{self.client.account_name}.blob.core.windows.net/{self.container}/{filename}?{sas_token}"
            logger.info(f"File saved to Azure Blob with SAS: {url}")
            return url

        except Exception as e:
            logger.error(f"Failed to save file to Azure Blob {filename}: {e}")
            raise StorageError(f"Azure save failed: {e}", e)


def get_storage() -> BaseStorage:
    """
    環境変数に基づいてストレージバックエンドを返す。

    Returns:
        BaseStorage: ストレージインスタンス。

    Raises:
        StorageError: 不明なプロバイダーまたは設定エラー。
    """
    provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    try:
        if provider == "local":
            return LocalStorage()
        elif provider == "s3":
            return S3Storage()
        elif provider == "azure":
            return AzureBlobStorage()
        else:
            raise StorageError(f"Unknown storage provider: {provider}")
    except StorageError:
        raise
    except Exception as e:
        logger.error(f"Storage initialization failed: {e}")
        raise StorageError(f"Storage setup failed: {e}")
