import sys
import os
import base64
sys.path.append('.')
from backend.engines.youtube import _get_cookie_file

# Create dummy content
dummy_cookie = '{"test": "dummy_cookie_content"}'
b64_dummy = base64.b64encode(dummy_cookie.encode('utf-8')).decode('utf-8')

# Set env var
os.environ['YOUTUBE_COOKIES_BASE64'] = b64_dummy

# Run function
cookie_file = _get_cookie_file()
print(f"Cookie file path returned: {cookie_file}")

if cookie_file and os.path.exists(cookie_file):
    with open(cookie_file, 'r') as f:
        content = f.read()
    print(f"File content: {content}")
    os.remove(cookie_file)
else:
    print("Test failed: No cookie file returned or file does not exist.")
