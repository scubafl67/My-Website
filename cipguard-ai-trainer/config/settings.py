import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///profiles/teammates.db")
VECTORSTORE_DIR = os.getenv("VECTORSTORE_DIR", "data/vectorstore/db")
DEFAULT_DOMAIN = os.getenv("DEFAULT_DOMAIN", "nerc_cip")

VOICE_ENABLED = os.getenv("VOICE_ENABLED", "true").lower() in ("true", "1", "yes")
STT_ENGINE = os.getenv("STT_ENGINE", "granite")
TTS_ENGINE = os.getenv("TTS_ENGINE", "kokoro")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
