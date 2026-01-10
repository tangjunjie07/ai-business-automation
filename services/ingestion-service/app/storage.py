import os
import asyncio
from typing import Optional
from pathlib import Path


class StorageError(Exception):
    pass


class BaseStorage:
    async def save(self, filename: str, data: bytes) -> str:
        raise NotImplementedError()


class LocalStorage(BaseStorage):
    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path or os.getenv("LOCAL_STORAGE_PATH", "/tmp/aba_files"))
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def save(self, filename: str, data: bytes) -> str:
        path = self.base_path / filename
        # ensure parent directories exist
        path.parent.mkdir(parents=True, exist_ok=True)
        def _write():
            with open(path, "wb") as f:
                f.write(data)
        await asyncio.to_thread(_write)
        return str(path)


class S3Storage(BaseStorage):
    def __init__(self):
        import boto3
        self.bucket = os.getenv("S3_BUCKET")
        if not self.bucket:
            raise StorageError("S3_BUCKET not configured")
        session = boto3.session.Session()
        self.client = session.client("s3")

    async def save(self, filename: str, data: bytes) -> str:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.client.put_object, {
            'Bucket': self.bucket,
            'Key': filename,
            'Body': data
        })
        return f"s3://{self.bucket}/{filename}"


class AzureBlobStorage(BaseStorage):
    def __init__(self):
        from azure.storage.blob import BlobServiceClient
        conn_str = os.getenv("AZURE_BLOB_CONNECTION_STRING")
        self.container = os.getenv("AZURE_BLOB_CONTAINER")
        if not conn_str or not self.container:
            raise StorageError("Azure Blob storage not configured")
        self.client = BlobServiceClient.from_connection_string(conn_str)

    async def save(self, filename: str, data: bytes) -> str:
        container_client = self.client.get_container_client(self.container)
        def _upload():
            blob_client = container_client.get_blob_client(filename)
            blob_client.upload_blob(data, overwrite=True)
        await asyncio.to_thread(_upload)
        return f"https://{self.client.account_name}.blob.core.windows.net/{self.container}/{filename}"


def get_storage() -> BaseStorage:
    provider = os.getenv("STORAGE_PROVIDER", "local").lower()
    if provider == "local":
        return LocalStorage()
    if provider == "s3":
        return S3Storage()
    if provider == "azure":
        return AzureBlobStorage()
    raise StorageError(f"Unknown storage provider: {provider}")
