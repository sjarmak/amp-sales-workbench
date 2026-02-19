#!/usr/bin/env python3
"""Test Gong API authentication and endpoints."""

import os
import json
import requests

api_key = os.environ.get('GONG_ACCESS_KEY')

if not api_key:
    print("❌ GONG_ACCESS_KEY not set")
    exit(1)

print(f"Testing with key: {api_key[:20]}...")

# Try different auth methods
tests = [
    {
        "name": "Bearer token",
        "headers": {"Authorization": f"Bearer {api_key}"},
        "endpoint": "https://api.gong.io/v2/calls/transcripts/retrieve"
    },
    {
        "name": "Basic auth (key:secret split)",
        "headers": {"Authorization": f"Basic {api_key}"},
        "endpoint": "https://api.gong.io/v2/calls/transcripts/retrieve"
    },
    {
        "name": "Direct header",
        "headers": {"X-API-Key": api_key},
        "endpoint": "https://api.gong.io/v2/calls/transcripts/retrieve"
    },
]

for test in tests:
    print(f"\n📍 Testing: {test['name']}")
    print(f"   Endpoint: {test['endpoint']}")
    print(f"   Headers: {test['headers']}")
    
    try:
        response = requests.post(
            test['endpoint'],
            json={"callIds": ["test"]},
            headers={**test['headers'], "Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text[:200]}")
        
        if response.status_code == 200:
            print("   ✅ WORKS!")
        elif response.status_code == 401:
            print("   ❌ Unauthorized")
        else:
            print(f"   ⚠️  Other error")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
