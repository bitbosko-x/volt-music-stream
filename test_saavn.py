import saavn_engine

# Real world example 1: hub.py passes search_term and artist_filter
res1 = saavn_engine.search_saavn_enhanced("Sing Me to Sleep Alan Walker", ["Alan Walker"])
print("\n--- Test 1 ---")
if res1:
    print(f"Top Result: {res1[0]['title']} - {res1[0]['artist']}")

# Real world example 2: Raw search with no artist_filter, but artist in query
res2 = saavn_engine.search_saavn_enhanced("Sing Me to Sleep Alan Walker")
print("\n--- Test 2 ---")
if res2:
    print(f"Top Result: {res2[0]['title']} - {res2[0]['artist']}")
