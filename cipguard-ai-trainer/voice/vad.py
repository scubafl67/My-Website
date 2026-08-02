"""Voice Activity Detection using Silero VAD.

Detects when the teammate starts/stops speaking to manage turn-taking
in the bidirectional voice pipeline.
"""

import numpy as np
from pathlib import Path
import yaml


def load_voice_config() -> dict:
    config_path = Path(__file__).parent / "voice_config.yaml"
    with open(config_path) as f:
        return yaml.safe_load(f)


class VoiceActivityDetector:
    def __init__(self, config: dict = None):
        if config is None:
            config = load_voice_config().get("vad", {})
        self.threshold = config.get("threshold", 0.5)
        self.min_speech_ms = config.get("min_speech_duration_ms", 250)
        self.min_silence_ms = config.get("min_silence_duration_ms", 300)
        self._model = None
        self._is_speaking = False
        self._speech_start_samples = 0
        self._silence_start_samples = 0
        self._sample_rate = 16000

    def _load_model(self):
        if self._model is not None:
            return
        import torch
        self._model, self._utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad", model="silero_vad"
        )

    def process_chunk(self, audio_chunk: bytes, sample_rate: int = 16000) -> dict:
        """Process an audio chunk and return VAD state.

        Returns:
            {"is_speech": bool, "speech_started": bool, "speech_ended": bool, "confidence": float}
        """
        self._load_model()
        import torch

        self._sample_rate = sample_rate
        audio_array = np.frombuffer(audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
        audio_tensor = torch.from_numpy(audio_array)

        confidence = self._model(audio_tensor, sample_rate).item()
        is_speech = confidence >= self.threshold

        speech_started = False
        speech_ended = False

        if is_speech and not self._is_speaking:
            self._speech_start_samples += len(audio_array)
            min_samples = int(self.min_speech_ms * sample_rate / 1000)
            if self._speech_start_samples >= min_samples:
                self._is_speaking = True
                speech_started = True
                self._silence_start_samples = 0
        elif is_speech and self._is_speaking:
            self._silence_start_samples = 0
        elif not is_speech and self._is_speaking:
            self._silence_start_samples += len(audio_array)
            min_silence_samples = int(self.min_silence_ms * sample_rate / 1000)
            if self._silence_start_samples >= min_silence_samples:
                self._is_speaking = False
                speech_ended = True
                self._speech_start_samples = 0
        else:
            self._speech_start_samples = 0

        return {
            "is_speech": is_speech,
            "speech_started": speech_started,
            "speech_ended": speech_ended,
            "confidence": round(confidence, 3),
        }

    def reset(self):
        self._is_speaking = False
        self._speech_start_samples = 0
        self._silence_start_samples = 0
        if self._model is not None:
            self._model.reset_states()
