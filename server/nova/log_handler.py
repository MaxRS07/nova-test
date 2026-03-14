import asyncio
import logging
import sys


class _StickyHandlerLogger(logging.Logger):
    """
    A Logger subclass that keeps a set of "sticky" handlers that cannot be
    removed by direct assignment to `.handlers`. This is used to survive
    nova_act's Thinker class, which does `self.logger.handlers = [self.handler]`
    to take over the logger during its dot-animation, which would otherwise
    eject our WsLogHandler.
    """

    def __init__(self, name, level=logging.NOTSET):
        self._sticky_handlers: list[logging.Handler] = []
        super().__init__(name, level)

    def add_sticky_handler(self, handler: logging.Handler):
        self._sticky_handlers.append(handler)
        if handler not in self.handlers:
            self.handlers.append(handler)

    def remove_sticky_handler(self, handler: logging.Handler):
        if handler in self._sticky_handlers:
            self._sticky_handlers.remove(handler)
        if handler in self.handlers:
            self.handlers.remove(handler)

    @property  # type: ignore[override]
    def handlers(self):
        return self.__dict__.setdefault("_handlers", [])

    @handlers.setter
    def handlers(self, value):
        # Re-inject any sticky handlers that aren't in the new list
        merged = list(value)
        for h in self._sticky_handlers:
            if h not in merged:
                merged.append(h)
        self.__dict__["_handlers"] = merged


def _ensure_sticky_logger(logger_name: str) -> "_StickyHandlerLogger":
    """
    Replace the named logger with a _StickyHandlerLogger instance, preserving
    existing handlers and settings. Safe to call multiple times.
    """
    existing = logging.getLogger(logger_name)
    if isinstance(existing, _StickyHandlerLogger):
        return existing

    sticky = _StickyHandlerLogger(logger_name, existing.level)
    sticky.handlers = list(existing.handlers)
    sticky.propagate = existing.propagate
    logging.Logger.manager.loggerDict[logger_name] = sticky
    return sticky


def _is_animation_frame(msg: str) -> bool:
    """Return True if the message is a Thinker dot-animation frame (no real content)."""
    # Strip carriage returns and whitespace
    cleaned = msg.replace("\r", "").strip()
    if not cleaned:
        return True
    # Everything after the "a1b7> " prefix
    text = cleaned.split(">", 1)[-1].strip() if ">" in cleaned else cleaned
    # Animation frames are empty or contain only dots
    return not text or set(text) <= {".", " "}


class WsLogHandler(logging.Handler):
    """
    Forwards nova_act log records to the client via run_manager over WebSocket.
    Attaches itself as a sticky handler so it survives Thinker's handler swap.
    """

    def __init__(self, run_id: str, loop: asyncio.AbstractEventLoop):
        super().__init__()
        self.run_id = run_id
        self.loop = loop
        self.setFormatter(logging.Formatter("%(message)s"))
        self._sticky_logger: "_StickyHandlerLogger | None" = None

    def attach(self, logger_name: str):
        sticky = _ensure_sticky_logger(logger_name)
        sticky.add_sticky_handler(self)
        self._sticky_logger = sticky

    def detach(self):
        if self._sticky_logger is not None:
            self._sticky_logger.remove_sticky_handler(self)
            self._sticky_logger = None

    def emit(self, record: logging.LogRecord):
        msg = self.format(record)
        if _is_animation_frame(msg):
            return
        self._send(msg.replace("\r", "").strip(), record.levelname)

    def _send(self, message: str, level: str = "INFO"):
        if not message:
            return
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
    Replaces sys.stdout in the nova_act thread so that any direct print()
    output is forwarded over WebSocket. Buffers partial writes and only sends
    complete lines with real alphanumeric content.
    """

    def __init__(self, run_id: str, loop: asyncio.AbstractEventLoop, passthrough: bool = False):
        self.run_id = run_id
        self.loop = loop
        self.passthrough = passthrough
        self._original = sys.stdout
        self._buffer = ""

    def _emit_line(self, line: str):
        stripped = line.replace("\r", "").strip()
        if not stripped or _is_animation_frame(stripped):
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
