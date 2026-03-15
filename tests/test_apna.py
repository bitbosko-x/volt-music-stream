import sys
import os

# Add Volt to path
sys.path.insert(0, '/home/mak/Volt')

from backend.engines.saavn import search_saavn_enhanced

query = 'Apna Bana Le (From "Bhediya") Arijit Singh, Sachin-Jigar & Amitabh Bhattacharya'
artist_filter = ['Arijit Singh, Sachin-Jigar & Amitabh Bhattacharya']

results = search_saavn_enhanced(query, artist_filter)
if results:
    print(f"\nSUCCESS: Found {len(results)} results")
    for r in results:
        print(f" - {r['title']} by {r['artist']}")
else:
    print("\nFAILED: No results returned")
