"""
iTunes India - Latest Releases sorted by Popularity
Uses Apple's iTunes RSS Feed API (free, no API key required)
"""

import urllib.request
import json
from datetime import datetime


def parse_link(raw_link):
    """Safely parse the 'link' field which can be a dict or a list of dicts."""
    if isinstance(raw_link, list):
        for item in raw_link:
            if isinstance(item, dict):
                attrs = item.get("attributes", {})
                if attrs.get("type") == "text/html" or attrs.get("rel") == "alternate":
                    return attrs.get("href", "N/A")
        if raw_link and isinstance(raw_link[0], dict):
            return raw_link[0].get("attributes", {}).get("href", "N/A")
    elif isinstance(raw_link, dict):
        return raw_link.get("attributes", {}).get("href", "N/A")
    return "N/A"


def parse_genre(raw_category):
    """Safely parse the 'category' field which can be a dict or a list of dicts."""
    if isinstance(raw_category, list):
        if raw_category and isinstance(raw_category[0], dict):
            return raw_category[0].get("attributes", {}).get("label", "N/A")
    elif isinstance(raw_category, dict):
        return raw_category.get("attributes", {}).get("label", "N/A")
    return "N/A"


def fetch_itunes_india_latest_releases(
    media_type: str = "music",
    limit: int = 50,
    feed_type: str = "newreleases"
):
    """
    Fetch latest releases from iTunes India RSS Feed.

    Args:
        media_type : 'music', 'album', 'song', 'musicvideo', 'movie', 'podcast'
        limit      : Number of results (max 100)
        feed_type  : 'newreleases', 'recentreleases', 'topsongs', 'topalbums'
    """
    # iTunes RSS Feed Generator - correct URL format
    url = f"https://itunes.apple.com/in/rss/{feed_type}/limit={limit}/{media_type}/json"

    print(f"\n🎵 Fetching iTunes India Latest Releases...")
    print(f"   URL: {url}\n")

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (iTunes-RSS-Fetcher/1.0)"}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"❌ Error fetching data: {e}")
        return []

    entries = data.get("feed", {}).get("entry", [])
    if not entries:
        print("⚠️  No entries found in response.")
        return []

    releases = []
    for idx, entry in enumerate(entries):
        title      = entry.get("im:name", {}).get("label", "N/A")
        artist     = entry.get("im:artist", {}).get("label", "N/A")
        price      = entry.get("im:price", {}).get("label", "N/A")
        release_dt = entry.get("im:releaseDate", {}).get("label", "N/A")
        genre      = parse_genre(entry.get("category"))
        link       = parse_link(entry.get("link", {}))
        rank       = idx + 1  # iTunes RSS returns results in popularity order

        # Format release date nicely
        try:
            dt = datetime.fromisoformat(release_dt.replace("Z", "+00:00"))
            release_date = dt.strftime("%d %b %Y")
        except Exception:
            release_date = release_dt[:10] if release_dt != "N/A" else "N/A"

        releases.append({
            "rank"        : rank,
            "title"       : title,
            "artist"      : artist,
            "genre"       : genre,
            "price"       : price,
            "release_date": release_date,
            "link"        : link,
        })

    return releases


def display_releases(releases: list, feed_label: str):
    """Pretty-print the releases table to the terminal."""
    if not releases:
        print(f"  (No data to display for: {feed_label})\n")
        return

    print(f"{'='*85}")
    print(f"  🇮🇳  iTunes India — {feed_label}  (Sorted by Popularity)")
    print(f"{'='*85}")
    print(f"{'#':<4} {'Title':<34} {'Artist':<24} {'Genre':<18} {'Released':<12} {'Price'}")
    print(f"{'-'*85}")

    for r in releases:
        title  = (r["title"][:32]  + "..") if len(r["title"])  > 34 else r["title"]
        artist = (r["artist"][:22] + "..") if len(r["artist"]) > 24 else r["artist"]
        genre  = (r["genre"][:16]  + "..") if len(r["genre"])  > 18 else r["genre"]
        print(
            f"{r['rank']:<4} {title:<34} {artist:<24} {genre:<18} {r['release_date']:<12} {r['price']}"
        )

    print(f"{'='*85}")
    print(f"  Total: {len(releases)} entries\n")


def save_to_json(data: dict, filename: str = "itunes_india_releases.json"):
    """Save all results to a JSON file."""
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON saved → {filename}")


def save_to_csv(releases: list, filename: str = "itunes_india_releases.csv"):
    """Save a flat list of releases to a CSV file."""
    import csv
    if not releases:
        print("⚠️  No data to save to CSV.")
        return
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=releases[0].keys())
        writer.writeheader()
        writer.writerows(releases)
    print(f"✅ CSV saved  → {filename}")


# ─────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────
if __name__ == "__main__":

    # 1. Latest New Album Releases in India
    new_releases = fetch_itunes_india_latest_releases(
        media_type="album",
        limit=25,
        feed_type="newreleases"
    )
    display_releases(new_releases, "Latest New Album Releases")

    # 2. Top Songs - sorted by popularity
    top_songs = fetch_itunes_india_latest_releases(
        media_type="song",
        limit=25,
        feed_type="topsongs"
    )
    display_releases(top_songs, "Top Songs (Popular)")

    # 3. Top Albums - sorted by popularity
    top_albums = fetch_itunes_india_latest_releases(
        media_type="album",
        limit=25,
        feed_type="topalbums"
    )
    display_releases(top_albums, "Top Albums (Popular)")

    # Save outputs
    all_data = {
        "region"      : "India (in)",
        "fetched_at"  : datetime.now().astimezone().isoformat(),
        "new_releases": new_releases,
        "top_songs"   : top_songs,
        "top_albums"  : top_albums,
    }
    save_to_json(all_data, "itunes_india_releases.json")

    # Flatten & deduplicate for CSV
    flat = top_songs + top_albums + new_releases
    seen, unique = set(), []
    for r in flat:
        key = (r["title"], r["artist"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    save_to_csv(unique, "itunes_india_releases.csv")

    print("\n🎉 Done! iTunes store links are saved in the JSON file.\n")
