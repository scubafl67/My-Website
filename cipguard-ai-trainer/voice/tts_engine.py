"""Text-to-Speech engine abstraction layer.

Provides a unified interface across all supported TTS models (Kokoro,
Chatterbox, Piper). Models are swappable via voice_config.yaml.
"""

import io
import os
import yaml
import numpy as np
from abc import ABC, abstractmethod
from pathlib import Path


def load_voice_config() -> dict:
    config_path = Path(__file__).parent / "voice_config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


class TTSEngine(ABC):
    @abstractmethod
    def synthesize(self, text: str) -> dict:
        """Synthesize text to audio.

        Returns:
            {"audio": bytes, "sample_rate": int, "duration_s": float}
        """

    @abstractmethod
    def synthesize_stream(self, text: str):
        """Yield audio chunks as they're generated for streaming playback."""

    @property
    @abstractmethod
    def engine_name(self) -> str:
        pass


class KokoroTTS(TTSEngine):
    """Kokoro 82M — Apache 2.0, CPU-capable, natural narration."""

    def __init__(self, config: dict):
        self.config = config
        self.model_id = config.get("model", "hexgrad/Kokoro-82M")
        self.voice = config.get("voice", "af_heart")
        self.speed = config.get("speed", 1.0)
        self.sample_rate = config.get("sample_rate", 24000)
        self._pipeline = None

    def _load_model(self):
        if self._pipeline is not None:
            return
        from kokoro import KPipeline
        self._pipeline = KPipeline(lang_code="a")

    def synthesize(self, text: str) -> dict:
        self._load_model()
        audio_segments = []
        for result in self._pipeline(text, voice=self.voice, speed=self.speed):
            if result.audio is not None:
                audio_segments.append(result.audio)

        if not audio_segments:
            return {"audio": b"", "sample_rate": self.sample_rate, "duration_s": 0.0}

        full_audio = np.concatenate(audio_segments)
        audio_bytes = (full_audio * 32767).astype(np.int16).tobytes()
        duration = len(full_audio) / self.sample_rate

        return {
            "audio": audio_bytes,
            "sample_rate": self.sample_rate,
            "duration_s": round(duration, 2),
            "engine": self.engine_name,
        }

    def synthesize_stream(self, text: str):
        self._load_model()
        for result in self._pipeline(text, voice=self.voice, speed=self.speed):
            if result.audio is not None:
                chunk_bytes = (result.audio * 32767).astype(np.int16).tobytes()
                yield {
                    "audio": chunk_bytes,
                    "sample_rate": self.sample_rate,
                    "partial": True,
                }

    @property
    def engine_name(self) -> str:
        return "kokoro"


class ChatterboxTTS(TTSEngine):
    """Chatterbox 0.5B — MIT, most natural voice, voice cloning."""

    def __init__(self, config: dict):
        self.config = config
        self.model_id = config.get("model", "resemble-ai/chatterbox-0.5b")
        self.sample_rate = config.get("sample_rate", 24000)
        self._model = None

    def _load_model(self):
        if self._model is not None:
            return
        from chatterbox.tts import ChatterboxTTS as CBModel
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        self._model = CBModel.from_pretrained(device=device)
        self._device = device

    def synthesize(self, text: str) -> dict:
        self._load_model()
        import torchaudio

        audio_tensor = self._model.generate(text)
        audio_np = audio_tensor.squeeze().cpu().numpy()
        audio_bytes = (audio_np * 32767).astype(np.int16).tobytes()
        duration = len(audio_np) / self.sample_rate

        return {
            "audio": audio_bytes,
            "sample_rate": self.sample_rate,
            "duration_s": round(duration, 2),
            "engine": self.engine_name,
        }

    def synthesize_stream(self, text: str):
        result = self.synthesize(text)
        yield result

    @property
    def engine_name(self) -> str:
        return "chatterbox"


class PiperTTS(TTSEngine):
    """Piper — MIT, ultra-lightweight for edge/IoT."""

    def __init__(self, config: dict):
        self.config = config
        self.voice = config.get("voice", "en_US-lessac-medium")
        self.sample_rate = config.get("sample_rate", 22050)
        self._synth = None

    def _load_model(self):
        if self._synth is not None:
            return
        import piper
        self._synth = piper.PiperVoice.load(self.voice)

    def synthesize(self, text: str) -> dict:
        self._load_model()
        audio_data = b""
        for audio_bytes in self._synth.synthesize_stream_raw(text):
            audio_data += audio_bytes

        audio_array = np.frombuffer(audio_data, dtype=np.int16)
        duration = len(audio_array) / self.sample_rate

        return {
            "audio": audio_data,
            "sample_rate": self.sample_rate,
            "duration_s": round(duration, 2),
            "engine": self.engine_name,
        }

    def synthesize_stream(self, text: str):
        self._load_model()
        for audio_bytes in self._synth.synthesize_stream_raw(text):
            yield {
                "audio": audio_bytes,
                "sample_rate": self.sample_rate,
                "partial": True,
            }

    @property
    def engine_name(self) -> str:
        return "piper"


ENGINE_REGISTRY: dict[str, type[TTSEngine]] = {
    "kokoro": KokoroTTS,
    "chatterbox": ChatterboxTTS,
    "piper": PiperTTS,
}


def create_tts_engine(engine_name: str = None) -> TTSEngine:
    config = load_voice_config()
    name = engine_name or config["tts"]["engine"]
    engine_config = config["tts"]["engines"].get(name)
    if not engine_config:
        raise ValueError(f"Unknown TTS engine: {name}. Available: {list(config['tts']['engines'].keys())}")
    engine_class = ENGINE_REGISTRY.get(name)
    if not engine_class:
        raise ValueError(f"No implementation for TTS engine: {name}. Available: {list(ENGINE_REGISTRY.keys())}")
    return engine_class(engine_config)
