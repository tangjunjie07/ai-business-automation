#!/usr/bin/env python3
"""
Delete all blobs in the container specified by AZURE_BLOB_CONTAINER using
AZURE_BLOB_CONNECTION_STRING from the repository .env or environment.

Usage:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install azure-storage-blob python-dotenv
  python services/ingestion-service/scripts/delete_azure_uploads.py

This script intentionally requires running inside a virtual environment
so it does not try to modify system Python packages.
"""
import os
import sys
from dotenv import load_dotenv

# load .env from repo root
repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
dotenv_path = os.path.join(repo_root, '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

conn = os.getenv('AZURE_BLOB_CONNECTION_STRING')
container = os.getenv('AZURE_BLOB_CONTAINER')

if not conn or not container:
    print('AZURE_BLOB_CONNECTION_STRING or AZURE_BLOB_CONTAINER not set in environment or .env')
    sys.exit(1)

try:
    from azure.storage.blob import BlobServiceClient
except Exception as e:
    print('Missing dependency azure-storage-blob. Install into a virtualenv:')
    print('  python3 -m venv .venv && source .venv/bin/activate && pip install azure-storage-blob python-dotenv')
    sys.exit(2)

svc = BlobServiceClient.from_connection_string(conn)
container_client = svc.get_container_client(container)

print('Listing blobs in container:', container)
blobs = list(container_client.list_blobs())
if not blobs:
    print('No blobs found; nothing to delete.')
    sys.exit(0)

print('Found', len(blobs), 'blobs. Deleting...')
for b in blobs:
    name = b.name
    try:
        container_client.delete_blob(name)
        print('Deleted', name)
    except Exception as e:
        print('Failed to delete', name, 'error:', e)

remaining = list(container_client.list_blobs())
print('Remaining blobs after delete:', len(remaining))
if remaining:
    print('Some blobs remain; review permissions and retry.')
else:
    print('All blobs removed from container', container)
