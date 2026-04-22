"""
Runs inside the Docker build.
1. Converts requirements.txt from UTF-16 → UTF-8  (Windows saves as UTF-16)
2. Strips --hash=sha256:... entries              (pip hash-checking breaks in Docker)
3. Strips --require-hashes flag if present
"""
import re

raw = open("requirements.txt", "rb").read()

# Decode: UTF-16 (Windows BOM) or plain UTF-8
if raw[:2] in (b"\xff\xfe", b"\xfe\xff"):
    text = raw.decode("utf-16")
else:
    text = raw.decode("utf-8")

clean = []
for line in text.splitlines():
    line = re.sub(r"\s*\\?\s*--hash=\S+", "", line)   # strip hash entries
    line = line.strip()
    if line and not line.startswith("--require-hashes") and not line.startswith("--hash"):
        clean.append(line)

open("requirements.txt", "w", encoding="utf-8").write("\n".join(clean) + "\n")
print(f"requirements.txt cleaned: {len(clean)} packages")
