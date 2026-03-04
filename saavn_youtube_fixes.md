# Saavn & YouTube Fixes - Conversation Summary

## Issues Fixed

### Issue 1: JioSaavn not finding songs with featured artists

**Problem**: 
- Songs like "Have The Heart feat. Dolly Parton Post Malone" weren't found in JioSaavn
- The search query contained Dolly Parton but JioSaavn didn't have her name in the metadata

**Root Cause**: 
- The fallback condition didn't for "feat" in trigger query
- For "Devil I've Been (feat. ERNEST) Post Malone": query had "feat." but fallback only looked for "feat" (no period)

**Fix** (saavn_engine.py):
- Added `'feat' in query.lower() or 'ft.' in query.lower()` to fallback trigger condition
- Changed lite_query extraction to remove featured artist but keep main artist
- New regex: `re.sub(r'\(feat\.?[^)]*\)|feat\.?[^,]*[,]|\(ft\.?[^)]*\)|ft\.?[^,]*[,]', '', query, flags=re.IGNORECASE)`

**Result**: 
- "Devil I've Been (feat. ERNEST) Post Malone" → lite query: "Devil I've Been Post Malone"
- Song found in JioSaavn!

---

### Issue 2: YouTube "Requested format is not available" error

**Problem**:
- ERROR: [youtube] 8mW_FI-SN0Y: Requested format is not available. Use --list-formats for a list of available formats

**Root Cause**:
- Format string `'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best'` was too strict
- When exact format wasn't available, yt-dlp errored instead of falling back

**Fix** (yt_engine.py):
- Simplified format to `'bestaudio/best'`
- Added fallback formats: `'audio/best'`, `'best'`

---

## Files Modified

1. **saavn_engine.py** (lines 70-76)
2. **yt_engine.py** (lines 102-106, 138-142)
