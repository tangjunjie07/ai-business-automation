Azure uploads deletion helper

This script helps delete all blobs in the container configured by
`AZURE_BLOB_CONNECTION_STRING` and `AZURE_BLOB_CONTAINER`.

How to run (recommended, uses a virtualenv):

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install azure-storage-blob python-dotenv
python services/ingestion-service/scripts/delete_azure_uploads.py
```

Notes:
- The script reads `.env` in the repository root if present.
- Run in a safe environment; deletion is irreversible.
