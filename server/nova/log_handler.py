import asyncio
import logging
import sys


class WsLogHandler(logging.Handler):
    """Forwards nova_act log records to the client via run_manager over WebSocket."""

    def __init__(self, run_id: str, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.run_id = run_id
        self.loop = loop
        self.setFormatter(logging.Formatter("%(name)s: %(message)s"))

    def emit(self, record: logging.LogRecord):
        msg = self.format(record)
        # Strip ANSI escape codes, carriage returns, and whitespace
        cleaned = msg.replace("\r", "").strip()
        # Skip lines that are only dots, spaces, or emoji (Thinker animation frames)
        if not cleaned or not any(c.isalpha() or c.isdigit() for c in cleaned):
            return
        # Skip lines that are purely dots with optional prefix (e.g. "ef7a> ...")
        text_after_prefix = cleaned.split(">", 1)[-1].strip() if ">" in cleaned else cleaned
        if not text_after_prefix or set(text_after_prefix) <= {".", " "}:
            return
        self._send(cleaned, record.levelname)

    def _send(self, message: str, level: str = "INFO"):
        try:
            from websocket_manager import run_manager
            asyncio.run_coroutine_threadsafe(
                run_manager.send(self.run_id, {
                    "type": "log",
                    "level": level,
                    "message": message,
                }),
                self.loop,
            )
        except Exception:
            pass


class WsStdoutCapture:
    """
    Replaces sys.stdout in the nova_act thread so that NovaAct's direct
    print() output is forwarded over WebSocket instead of (or in addition to)
    the terminal. Buffers partial writes and only sends complete lines that
    contain alphanumeric text, preventing duplicate/emoji-only spinner updates.
    """

    def __init__(self, run_id: str, loop: asyncio.AbstractEventLoop, passthrough: bool = False):
        self.run_id = run_id
        self.loop = loop
        self.passthrough = passthrough
        self._original = sys.stdout
        self._buffer = ""

    def _has_text(self, s: str) -> bool:
        return any(c.isalpha() or c.isdigit() for c in s)

    def _emit_line(self, line: str):
        stripped = line.strip()
        if not stripped or not self._has_text(stripped):
            return
        # Skip pure dot-animation lines (e.g. "ef7a> ..." or "ef7a> ..")
        text_after_prefix = stripped.split(">", 1)[-1].strip() if ">" in stripped else stripped
        if not text_after_prefix or set(text_after_prefix) <= {".", " "}:
            return
        try:
            from websocket_manager import run_manager
            asyncio.run_coroutine_threadsafe(
                run_manager.send(self.run_id, {
                    "type": "log",
                    "level": "INFO",
                    "message": stripped,
                }),
                self.loop,
            )
        except Exception:
            pass

    def write(self, text: str):
        if self.passthrough:
            self._original.write(text)
        # Carriage returns overwrite the current line in terminals — treat as
        # line terminators so spinner frames are processed and discarded.
        text = text.replace("\r", "\n")
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            self._emit_line(line)

    def flush(self):
        if self.passthrough:
            self._original.flush()
        if self._buffer:
            self._emit_line(self._buffer)
            self._buffer = ""

    def __enter__(self):
        sys.stdout = self
        return self

    def __exit__(self, *_):
        sys.stdout = self._original
