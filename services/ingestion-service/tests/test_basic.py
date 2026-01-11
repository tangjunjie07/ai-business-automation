"""
Basic unit tests for the ingestion service.
Run with: python -m pytest tests/
"""
import pytest
import asyncio
from unittest.mock import Mock, patch
from app.storage import LocalStorage, StorageError
from app.ocr_ai import OCRConfig, load_master_data


class TestLocalStorage:
    """Test LocalStorage functionality."""

    def test_save_valid_data(self, tmp_path):
        """Test saving valid data to local storage."""
        storage = LocalStorage(tmp_path)
        test_data = b"Hello, World!"
        filename = "test.txt"

        result = asyncio.run(storage.save(filename, test_data))

        assert str(tmp_path / filename) == result
        assert (tmp_path / filename).read_bytes() == test_data

    def test_save_empty_data_raises_error(self, tmp_path):
        """Test that saving empty data raises StorageError."""
        storage = LocalStorage(tmp_path)

        with pytest.raises(StorageError, match="Cannot save empty data"):
            asyncio.run(storage.save("empty.txt", b""))


class TestOCRConfig:
    """Test OCRConfig functionality."""

    @patch.dict('os.environ', {
        'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT': 'https://test.cognitiveservices.azure.com/',
        'AZURE_DOCUMENT_INTELLIGENCE_KEY': 'test-key',
        'AZURE_OPENAI_ENDPOINT': 'https://test.openai.azure.com/',
        'AZURE_OPENAI_API_KEY': 'test-openai-key',
        'AZURE_OPENAI_DEPLOYMENT': 'gpt-4o-mini'
    })
    def test_config_validation_success(self):
        """Test successful configuration validation."""
        config = OCRConfig()
        assert config.azure_endpoint == 'https://test.cognitiveservices.azure.com/'
        assert config.azure_key == 'test-key'
        assert config.azure_openai_endpoint == 'https://test.openai.azure.com/'

    @patch.dict('os.environ', {}, clear=True)
    def test_config_validation_missing_required(self):
        """Test configuration validation with missing required settings."""
        with pytest.raises(ValueError, match="Azure Document Intelligence credentials are required"):
            OCRConfig()


class TestMasterDataLoading:
    """Test master data loading functionality."""

    def test_load_master_data_structure(self):
        """Test that master data has expected structure."""
        data = load_master_data()

        assert isinstance(data, dict)
        assert 'account_subjects' in data
        assert 'rules' in data
        assert 'output_format' in data
        assert isinstance(data['account_subjects'], dict)
        assert isinstance(data['rules'], list)


if __name__ == "__main__":
    pytest.main([__file__])