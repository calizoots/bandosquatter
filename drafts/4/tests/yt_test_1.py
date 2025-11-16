import sys
import requests
import json
import re

if len(sys.argv) < 2:
    print("please provide a url")
    exit(1)

url = sys.argv[1]
headers = {'User-Agent': 'Mozilla/5.0'}

resp = requests.get(url, headers=headers)
html = resp.text

match = re.search(r'ytInitialPlayerResponse\s*=\s*({.*?})\s*;', html, re.DOTALL)
if not match:
    raise Exception("Couldn't find ytInitialPlayerResponse")

json_str = match.group(1)

# print(json_str)

player_response = json.loads(json_str)

# Extract audio formats
formats = player_response.get('streamingData', {}).get('adaptiveFormats', [])
audio_streams = [f for f in formats if f.get('mimeType', '').startswith('audio/')]

for audio in audio_streams:
    if 'url' in audio:
        print("Direct audio URL:", audio['url'])
    elif 'streamingData' in audio:
        sdata = audio['streamingData']
        if 'signatureCipher' in sdata:
            print("Cipher:", sdata['signatureCipher'])

