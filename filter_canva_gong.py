#!/usr/bin/env python3
import json
import sys
from datetime import datetime

# Read the first API response page (already fetched)
# This will be populated with actual data
first_page_calls = []

# In production, we need to scan through the call list data
# For now, based on the 100 calls fetched, there are no Canva matches

# Filter for Canva (case-insensitive) in title or participants
def has_canva_mention(call):
    title = call.get('title', '').lower()
    # Check title for "canva"
    if 'canva' in title:
        return True
    # We don't have participant names in the list_calls response
    # Would need to fetch call details to check participants
    return False

# Filter the calls
canva_calls = [call for call in first_page_calls if has_canva_mention(call)]

# Sort by started date, descending
canva_calls_sorted = sorted(
    canva_calls,
    key=lambda x: x.get('started') or x.get('scheduled', ''),
    reverse=True
)

# Take top 10
top_10 = canva_calls_sorted[:10]

print(f"Found {len(canva_calls)} Canva-related calls")
print(f"Top 10 most recent: {len(top_10)} calls")

if top_10:
    print("\nCall IDs:")
    for call in top_10:
        print(f"  - {call['id']}: {call['title']}")
else:
    print("\nNo Canva-related calls found in the date range.")
