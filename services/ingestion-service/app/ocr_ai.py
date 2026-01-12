import os
import json
import logging
import asyncio
import re
from typing import Dict, List, Any, Optional, Union
from pathlib import Path
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_openai import AzureChatOpenAI
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration class with validation
class OCRConfig:
    """Configuration for OCR and AI services."""

    def __init__(self):
        # Azure Document Intelligence settings
        self.azure_endpoint = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT")
        self.azure_key = os.getenv("AZURE_DOCUMENT_INTELLIGENCE_KEY")

        # OpenAI settings
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

        # Azure OpenAI settings
        self.azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        self.azure_openai_api_key = os.getenv("AZURE_OPENAI_API_KEY")
        self.azure_openai_api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        self.azure_openai_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini")

        # Model settings
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

        # Data file paths
        self.master_data_file = os.getenv("MASTER_DATA_FILE", "ai_accounting_config.md")
        self.prompts_file = os.getenv("PROMPTS_FILE", "prompts.md")

        # Validate configuration
        self._validate_config()

    def _validate_config(self):
        """Validate required configuration parameters."""
        if not all([self.azure_endpoint, self.azure_key]):
            raise ValueError("Azure Document Intelligence credentials are required")

        if not (self.openai_api_key or (self.azure_openai_endpoint and self.azure_openai_api_key)):
            raise ValueError("Either OpenAI API key or Azure OpenAI credentials must be provided")

        logger.info("OCR configuration validated successfully")

config = OCRConfig()

# マスタデータを読み込み
def load_master_data() -> Dict[str, Any]:
    """
    Load master data from Markdown file.

    Returns:
        Dict containing account subjects, rules, and output format.

    Raises:
        FileNotFoundError: If master data file is not found.
        ValueError: If parsing fails.
    """
    master_file_path = Path(__file__).parent / config.master_data_file

    try:
        with open(master_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        data = parse_markdown_content(content)
        data["markdown"] = content
        logger.info(f"Master data loaded successfully from {master_file_path}")
        return data

    except FileNotFoundError:
        logger.warning(f"Master data file not found: {master_file_path}, using defaults")
        return {
            "account_subjects": {},
            "rules": [],
            "output_format": {},
            "markdown": "# Default\n\nNo data available."
        }
    except (json.JSONDecodeError, ValueError, re.error) as e:
        logger.error(f"Failed to parse master data: {e}")
        raise ValueError(f"Master data parsing failed: {e}")

def parse_markdown_content(content: str) -> Dict[str, Any]:
    """
    Parse Markdown content to extract account subjects, rules, and output format.

    Args:
        content: Markdown content string.

    Returns:
        Dict containing parsed data.

    Raises:
        ValueError: If parsing fails.
    """
    try:
        # Extract JSON output format
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        output_format = json.loads(json_match.group(1)) if json_match else {}
        logger.info("Output format loaded from Markdown")

        # Extract account subjects
        account_subjects = {}
        subjects_match = re.search(r'## Account Subjects\s*(.*?)(?=##|\Z)', content, re.DOTALL)
        if subjects_match:
            lines = subjects_match.group(1).strip().split('\n')
            for line in lines:
                if ': ' in line:
                    key, values = line.split(': ', 1)
                    key = key.strip('- ').strip()
                    values = [v.strip() for v in values.split('、')]
                    account_subjects[key] = values
        logger.info(f"Account subjects loaded: {len(account_subjects)} entries")

        # Extract rules
        rules = []
        rules_match = re.search(r'## Rules\s*(.*?)(?=##|\Z)', content, re.DOTALL)
        if rules_match:
            lines = rules_match.group(1).strip().split('\n')
            for line in lines:
                if line.strip().startswith('- '):
                    rules.append(line.strip('- ').strip())
        logger.info(f"Rules loaded: {len(rules)} rules")

        return {
            "account_subjects": account_subjects,
            "rules": rules,
            "output_format": output_format
        }

    except json.JSONDecodeError as e:
        logger.error(f"JSON parsing error in output format: {e}")
        raise ValueError(f"Invalid JSON in output format: {e}")
    except Exception as e:
        logger.error(f"Unexpected error parsing Markdown content: {e}")
        raise ValueError(f"Markdown parsing failed: {e}")

master_data = load_master_data()

# プロンプトを読み込み
def load_prompts() -> Dict[str, str]:
    """
    Load prompt templates from Markdown file.

    Returns:
        Dict containing prompt templates.

    Raises:
        FileNotFoundError: If prompts file is not found.
        ValueError: If parsing fails.
    """
    prompts_file_path = Path(__file__).parent / config.prompts_file

    try:
        with open(prompts_file_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Extract System Prompt Template
        system_match = re.search(r'## System Prompt Template\s*```\s*(.*?)\s*```', content, re.DOTALL)
        system_prompt_template = system_match.group(1).strip() if system_match else ""

        # Extract User Prompt Template
        user_match = re.search(r'## User Prompt Template\s*```\s*(.*?)\s*```', content, re.DOTALL)
        user_prompt_template = user_match.group(1).strip() if user_match else ""

        # Extract User Message
        user_message_match = re.search(r'## User Message\s*```\s*(.*?)\s*```', content, re.DOTALL)
        user_message = user_message_match.group(1).strip() if user_message_match else ""

        logger.info("Prompts loaded successfully from Markdown")
        return {
            "system_prompt_template": system_prompt_template,
            "user_prompt_template": user_prompt_template,
            "user_message": user_message
        }

    except FileNotFoundError:
        logger.warning(f"Prompts file not found: {prompts_file_path}, using defaults")
        return _get_default_prompts()
    except Exception as e:
        logger.error(f"Failed to parse prompts: {e}")
        return _get_default_prompts()


def _get_default_prompts() -> Dict[str, str]:
    """Get default prompt templates."""
    return {
        "system_prompt_template": "# Role\nYou are a professional accounting AI.\n\n# Master Data\n{master_data}\n\n# OCR Text Content\n{ocr_content}\n\n# Output Format (JSON)\n{output_format}",
        "user_prompt_template": "Please analyze the following OCR text from an invoice.\n\nOCR Text:\n{ocr_content}",
        "user_message": "Please analyze the following OCR text from an invoice and infer the account subjects."
    }

prompts = load_prompts()
SYSTEM_PROMPT_TEMPLATE = prompts.get("system_prompt_template", "")
USER_PROMPT_TEMPLATE = prompts.get("user_prompt_template", "")

# システムプロンプトをマスタデータでフォーマット
output_format_json = json.dumps(master_data.get("output_format", {}), ensure_ascii=False, separators=(',', ':'))
# Keep the raw system prompt template; fill placeholders at runtime to avoid KeyError on import
system_prompt = SYSTEM_PROMPT_TEMPLATE

prompt = PromptTemplate(
    input_variables=["ocr_content"],
    template=USER_PROMPT_TEMPLATE
)

# Initialize LLM and parser
try:
    if config.azure_openai_endpoint and config.azure_openai_api_key:
        llm = AzureChatOpenAI(
            azure_endpoint=config.azure_openai_endpoint,
            api_key=config.azure_openai_api_key,
            api_version=config.azure_openai_api_version,
            deployment_name=config.model_name,
            temperature=0
        )
        logger.info(f"Using Azure OpenAI with model {config.model_name}")
    else:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model=config.model_name, temperature=0, openai_api_key=config.openai_api_key)
        logger.info(f"Using standard OpenAI with model {config.model_name}")

    parser = JsonOutputParser()
    logger.info("LLM and parser initialized successfully")

except Exception as e:
    logger.error(f"Failed to initialize LLM: {e}")
    raise RuntimeError(f"LLM initialization failed: {e}")

# チェーン作成（システムプロンプトを含む）
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage

async def analyze_document(file_url: Union[str, Path], tenant_id: str = None, job_id: str = None, progress_callback = None, user_message: Optional[str] = None) -> Dict[str, Any]:
    """
    Analyze document with OCR and AI inference.

    Args:
        file_url: URL or local file path to analyze.

    Returns:
        Dict containing OCR data and AI inference results.

    Raises:
        ValueError: For configuration or parsing errors.
        AzureError: For Azure API errors.
        RuntimeError: For unexpected errors.
    """
    logger.info(f"Starting document analysis for: {file_url}")
    # Log received user message (sanitized and truncated for safety)
    try:
        if user_message:
            um = str(user_message).replace('\u201c', '"').replace('\u201d', '"').replace('\u2018', "'").replace('\u2019', "'")
            logger.info(f"Received user_message (truncated 200): {um[:200]}")
        else:
            logger.info("No user_message provided for this analysis")
    except Exception:
        logger.warning("Failed to log user_message")

    try:
        # Send progress: Starting OCR
        if progress_callback:
            await progress_callback(job_id, "ocr_start", {"message": "Starting OCR analysis"})

        # Initialize Azure Document Intelligence client
        client = DocumentAnalysisClient(
            endpoint=config.azure_endpoint,
            credential=AzureKeyCredential(config.azure_key)
        )

        # Determine if URL or local file
        if str(file_url).startswith(('http://', 'https://')):
            logger.info("Processing as URL")
            poller = await asyncio.to_thread(
                client.begin_analyze_document_from_url,
                "prebuilt-invoice",
                str(file_url)
            )
        else:
            logger.info("Processing as local file")
            file_path = Path(file_url)
            if not file_path.exists():
                raise FileNotFoundError(f"File not found: {file_path}")

            with open(file_path, "rb") as f:
                poller = await asyncio.to_thread(
                    client.begin_analyze_document,
                    "prebuilt-invoice",
                    f
                )

        # Get analysis result
        result = await asyncio.to_thread(poller.result)
        logger.info(f"OCR analysis completed, extracted {len(result.content)} characters")

        # Send progress: OCR completed
        if progress_callback:
            await progress_callback(job_id, "ocr_complete", {"characters": len(result.content)})

        # Extract structured data
        ocr_data, items = _extract_invoice_data(result)

        # Get OCR content
        ocr_content = result.content or ""

        # Perform AI inference: call AI even if items list is empty, using OCR text
        logger.info(f"Starting AI inference (items_found={len(items)})")
        # Send progress: AI inference starting
        if progress_callback:
            try:
                await progress_callback(job_id, "ai_start", {"items_count": len(items)})
            except Exception:
                pass

        inferred_accounts = []
        # Only invoke AI when there's OCR content to analyze
        if ocr_content and str(ocr_content).strip():
            inferred_accounts = await _perform_ai_inference(ocr_content, items=items, ocr_data=ocr_data, user_message=user_message)
            logger.info("AI inference completed successfully")
            # Send progress: AI inference completed
            if progress_callback:
                try:
                    await progress_callback(job_id, "ai_complete", {"accounts_count": len(inferred_accounts)})
                except Exception:
                    pass
        else:
            logger.warning("No OCR text available to perform AI inference")

        return {
            "ocr_data": ocr_data,
            "ocr_content": ocr_content,
            "inferred_accounts": inferred_accounts
        }

    except AzureError as e:
        logger.error(f"Azure Document Intelligence error: {e}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"AI response parsing error: {e}")
        raise ValueError("Failed to parse AI response as JSON")
    except Exception as e:
        logger.error(f"Unexpected error in document analysis: {e}")
        raise RuntimeError(f"Document analysis failed: {e}")


def _extract_invoice_data(result) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Extract invoice data from Azure analysis result."""
    ocr_data = {}
    items = []

    for doc in result.documents:
        # Extract vendor name
        vendor_field = doc.fields.get("VendorName")
        if vendor_field and vendor_field.value:
            ocr_data["vendor"] = vendor_field.value

        # Extract invoice items
        invoice_items_field = doc.fields.get("Items")
        if invoice_items_field and invoice_items_field.value:
            for item in invoice_items_field.value:
                desc_field = item.value.get("Description")
                amt_field = item.value.get("Amount")
                if desc_field and amt_field and desc_field.value and amt_field.value:
                    items.append({
                        "description": desc_field.value,
                        "amount": amt_field.value
                    })

    logger.info(f"Extracted {len(items)} items from invoice")
    return ocr_data, items


async def _perform_ai_inference(ocr_content: str, items: Optional[List[Dict[str, Any]]] = None, ocr_data: Optional[Dict[str, Any]] = None, user_message: Optional[str] = None) -> List[Dict[str, Any]]:
    """Perform AI inference on OCR content."""
    try:
        # Prepare JSON snippets for system prompt substitution
        output_format_json = json.dumps(master_data.get("output_format", {}), ensure_ascii=False)
        try:
            items_json = json.dumps(items, ensure_ascii=False) if items else "[]"
        except Exception:
            items_json = "[]"
        try:
            ocr_data_json = json.dumps(ocr_data, ensure_ascii=False) if ocr_data else "{}"
        except Exception:
            ocr_data_json = "{}"

        # Build system prompt at runtime so {ocr_items} and {ocr_data} can be filled
        try:
            system_prompt_full = SYSTEM_PROMPT_TEMPLATE.format(
                master_data=master_data.get("markdown", ""),
                ocr_content=ocr_content,
                ocr_items=items_json,
                ocr_data=ocr_data_json,
                output_format=output_format_json
            )
        except Exception:
            # fallback to previous behavior
            system_prompt_full = system_prompt.replace("{ocr_content}", ocr_content)

        # Create chain and invoke
        # keep default prompt text separate so we don't overwrite the function arg `user_message`
        default_user_message = prompts.get("user_message", "Analyze the invoice OCR text and infer account subjects.")
        # combine OCR content, structured items, ocr_data and optional user message into a single human prompt
        # sanitize user_message special quotes
        payload_parts = ["OCR Text:\n", ocr_content]
        if items:
            try:
                items_json = json.dumps(items, ensure_ascii=False)
                payload_parts.append("\n\nExtracted Items (JSON):\n")
                payload_parts.append(items_json)
            except Exception:
                payload_parts.append("\n\nExtracted Items: (unserializable)\n")
        if ocr_data:
            try:
                ocr_data_json = json.dumps(ocr_data, ensure_ascii=False)
                payload_parts.append("\n\nOCR Metadata (JSON):\n")
                payload_parts.append(ocr_data_json)
            except Exception:
                payload_parts.append("\n\nOCR Metadata: (unserializable)\n")

        # include provided user_message or fall back to default_user_message
        try:
            if user_message:
                um = str(user_message).replace('\u201c', '"').replace('\u201d', '"').replace('\u2018', "'").replace('\u2019', "'")
            else:
                um = default_user_message
            payload_parts.append("\n\nUser Message:\n")
            payload_parts.append(um)
        except Exception:
            payload_parts.append("\n\nUser Message: (unserializable)\n")

        human_content = ''.join(payload_parts)

        # Log prompts for debugging (info level so developers can inspect without debug flag)
        try:
            logger.info("--- SYSTEM PROMPT START ---\n%s\n--- SYSTEM PROMPT END ---", system_prompt_full)
            logger.info("--- HUMAN PROMPT START ---\n%s\n--- HUMAN PROMPT END ---", human_content)
        except Exception:
            pass

        response = await asyncio.to_thread(
            llm.invoke,
            [
                SystemMessage(content=system_prompt_full),
                HumanMessage(content=human_content)
            ]
        )

        # Parse response
        inferred_accounts = parser.parse(response.content)
        return inferred_accounts if isinstance(inferred_accounts, list) else [inferred_accounts]

    except Exception as e:
        logger.error(f"AI inference failed: {e}")
        raise RuntimeError(f"AI inference failed: {e}")


async def perform_ai_inference(text: str) -> List[Dict[str, Any]]:
    """
    Public helper to perform AI inference on arbitrary text (no OCR).
    """
    # sanitize text
    txt = text.replace('\u201c', '"').replace('\u201d', '"').replace('\u2018', "'").replace('\u2019', "'")
    return await _perform_ai_inference(txt)


# Test functions have been removed for production