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
        self._send(msg, record.levelname)

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
    print() output (e.g. "ef7a> think(...)") is forwarded over WebSocket
    instead of (or in addition to) the terminal.
    Buffers partial writes and only sends complete lines that contain
    alphanumeric text, preventing duplicate/emoji-only loading-dot updates.
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
        if stripped and self._has_text(stripped):
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
        # Carriage returns are used by spinners to overwrite the current line —
        # treat them as line terminators so we discard partial/duplicate updates.
        text = text.replace("\r", "\n")
        self._buffer += text
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            self._emit_line(line)

    def flush(self):
        if self.passthrough:
            self._original.flush()
        # Flush any remaining buffered content that never got a newline
        if self._buffer:
            self._emit_line(self._buffer)
            self._buffer = ""

    def __enter__(self):
        sys.stdout = self
        return self

    def __exit__(self, *_):
        sys.stdout = self._original
