import sys
import os
from dotenv import load_dotenv

ENV_INITIALIZED = False

if not ENV_INITIALIZED:
    load_dotenv()
    ENV_INITIALIZED = True

if __name__ == "__main__":
    if 'test' in sys.argv[1:]:
        from test_playwright import test_playwright
        test_playwright()
    else:
        from api import start_server
        start_server()