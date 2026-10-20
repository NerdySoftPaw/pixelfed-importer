#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["requests>=2.31"]
# ///
"""Import posts from an Instagram data export into a Pixelfed account.

Uses the Mastodon-compatible Pixelfed API (/api/v1/media + /api/v1/statuses).
The API can't backdate posts, so the original Instagram date is added to the
caption. Progress is stored in a state file, so interrupted runs can be resumed.

    export PIXELFED_TOKEN=...   # Settings -> Applications -> Personal Access Token (read+write)
    ./ig2pixelfed.py ~/Downloads/instagram-xyz --instance https://pixelfed.social --dry-run
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import requests

# file in your_instagram_activity/media -> key holding the post list (None = top-level list)
SOURCES = {
    "posts": ("posts_1.json", None),
    "archived": ("archived_posts.json", "ig_archived_post_media"),
    "reels": ("reels.json", "ig_reels_media"),
    "igtv": ("igtv_videos.json", "ig_igtv_media"),
}


@dataclass
class Post:
    key: str
    source: str
    timestamp: int
    caption: str
    files: list[Path] = field(default_factory=list)


def fix_text(s: str) -> str:
    # Instagram exports UTF-8 text as latin-1 escaped bytes ("Iâm" instead of "I'm")
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return s


def load_posts(export: Path, sources: list[str]) -> list[Post]:
    media_dir = export / "your_instagram_activity" / "media"
    posts: dict[str, Post] = {}
    for src in sources:
        fname, key = SOURCES[src]
        path = media_dir / fname
        if not path.exists():
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data[key] if key else data
        for item in items:
            media = item.get("media") or []
            if not media:
                continue
            # single-media posts keep their caption on the media entry
            caption = item.get("title") or media[0].get("title") or ""
            ts = item.get("creation_timestamp") or media[0].get("creation_timestamp") or 0
            post = Post(
                key=f"{export.name}:{media[0]['uri']}",
                source=src,
                timestamp=ts,
                caption=fix_text(caption).strip(),
                files=[export / m["uri"] for m in media],
            )
            posts.setdefault(post.key, post)
    return sorted(posts.values(), key=lambda p: p.timestamp)


class Pixelfed:
    def __init__(self, instance: str, token: str):
        self.base = instance.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})

    def _request(self, method: str, path: str, **kw) -> dict:
        for attempt in range(6):
            r = self.s.request(method, self.base + path, timeout=300, **kw)
            if r.status_code == 429 or r.status_code >= 500:
                wait = int(r.headers.get("Retry-After") or 30 * (attempt + 1))
                print(f"    {r.status_code} from server, waiting {wait}s …", file=sys.stderr)
                time.sleep(wait)
                # rewind file handles before retrying an upload
                for f in (kw.get("files") or {}).values():
                    f[1].seek(0)
                continue
            if not r.ok:
                raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
            return r.json()
        raise RuntimeError(f"{method} {path}: giving up after retries")

    def verify(self) -> dict:
        return self._request("GET", "/api/v1/accounts/verify_credentials")

    def limits(self) -> tuple[int, int]:
        try:
            cfg = self._request("GET", "/api/v1/instance").get("configuration", {})
            st = cfg.get("statuses", {})
            return int(st.get("max_characters", 500)), int(st.get("max_media_attachments", 4))
        except Exception:
            return 500, 4

    def upload(self, path: Path) -> str:
        mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
        with path.open("rb") as fh:
            return self._request("POST", "/api/v1/media", files={"file": (path.name, fh, mime)})["id"]

    def post(self, text: str, media_ids: list[str], visibility: str, sensitive: bool) -> dict:
        data = {"status": text, "visibility": visibility, "media_ids[]": media_ids}
        if sensitive:
            data["sensitive"] = "true"
        return self._request("POST", "/api/v1/statuses", data=data)


def build_caption(caption: str, ts: int, limit: int, part: str, footer_fmt: str) -> str:
    footer = footer_fmt.format(date=datetime.fromtimestamp(ts).strftime("%d.%m.%Y")) if footer_fmt else ""
    tail = "".join(x for x in (f" {part}" if part else "", f"\n\n{footer}" if footer else ""))
    room = limit - len(tail)
    if len(caption) > room:
        caption = caption[: max(room - 1, 0)].rstrip() + "…"
    return (caption + tail).strip()


def load_state(path: Path) -> dict:
    return json.loads(path.read_text()) if path.exists() else {}


def save_state(path: Path, state: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=1))
    tmp.replace(path)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("exports", nargs="+", type=Path, help="unpacked Instagram export folder(s)")
    ap.add_argument("--instance", default=os.environ.get("PIXELFED_URL"), help="e.g. https://pixelfed.social (env PIXELFED_URL)")
    ap.add_argument("--token", default=os.environ.get("PIXELFED_TOKEN"), help="access token (env PIXELFED_TOKEN)")
    ap.add_argument("--include", default="posts", help=f"comma list of {','.join(SOURCES)} (default: posts)")
    ap.add_argument("--visibility", default="public", choices=["public", "unlisted", "private"])
    ap.add_argument("--sensitive", action="store_true", help="mark all imported posts as sensitive")
    ap.add_argument("--since", help="only posts on/after YYYY-MM-DD")
    ap.add_argument("--until", help="only posts before YYYY-MM-DD")
    ap.add_argument("--limit", type=int, help="import at most N posts this run")
    ap.add_argument("--delay", type=float, default=5, help="seconds to wait between posts (default 5)")
    ap.add_argument("--max-chars", type=int, help="override caption limit from instance")
    ap.add_argument("--max-media", type=int, help="override album size limit from instance")
    ap.add_argument("--footer", default="📷 Originally posted on Instagram, {date}", help="appended to caption, '' to disable")
    ap.add_argument("--skip-videos", action="store_true")
    ap.add_argument("--state", type=Path, default=Path("ig2pixelfed-state.json"))
    ap.add_argument("--dry-run", action="store_true", help="only show what would be posted")
    args = ap.parse_args()

    sources = [s.strip() for s in args.include.split(",") if s.strip()]
    if bad := [s for s in sources if s not in SOURCES]:
        ap.error(f"unknown --include value(s): {bad}")

    posts = [p for e in args.exports for p in load_posts(e.expanduser().resolve(), sources)]
    posts.sort(key=lambda p: p.timestamp)
    if args.since:
        posts = [p for p in posts if p.timestamp >= datetime.fromisoformat(args.since).timestamp()]
    if args.until:
        posts = [p for p in posts if p.timestamp < datetime.fromisoformat(args.until).timestamp()]
    if args.skip_videos:
        for p in posts:
            p.files = [f for f in p.files if f.suffix.lower() != ".mp4"]
        posts = [p for p in posts if p.files]

    state = load_state(args.state)
    todo = [p for p in posts if p.key not in state]
    if args.limit:
        todo = todo[: args.limit]
    done = sum(p.key in state for p in posts)
    print(f"{len(posts)} posts found, {done} already imported, {len(todo)} to go this run")

    client = None
    max_chars, max_media = 500, 4
    if not args.dry_run or (args.instance and args.token):
        if not (args.instance and args.token):
            ap.error("--instance and --token (or PIXELFED_URL / PIXELFED_TOKEN) are required")
        client = Pixelfed(args.instance, args.token)
        me = client.verify()
        max_chars, max_media = client.limits()
        print(f"logged in as @{me.get('acct') or me.get('username')} on {args.instance}")
    max_chars = args.max_chars or max_chars
    max_media = args.max_media or max_media
    print(f"limits: {max_chars} chars, {max_media} media per post\n")

    failed = 0
    for i, p in enumerate(todo, 1):
        chunks = [p.files[j : j + max_media] for j in range(0, len(p.files), max_media)]
        date = datetime.fromtimestamp(p.timestamp).strftime("%Y-%m-%d")
        print(f"[{i}/{len(todo)}] {date} {p.source} · {len(p.files)} file(s) → {len(chunks)} post(s) · {p.caption[:60]!r}")
        if missing := [f for f in p.files if not f.exists()]:
            print(f"    skip: missing files {missing}")
            failed += 1
            continue

        ids = []
        try:
            for n, chunk in enumerate(chunks, 1):
                part = f"({n}/{len(chunks)})" if len(chunks) > 1 else ""
                text = build_caption(p.caption if n == 1 else "", p.timestamp, max_chars, part, args.footer)
                if args.dry_run:
                    print(f"    would post {[f.name for f in chunk]} with {len(text)} chars")
                    continue
                media_ids = [client.upload(f) for f in chunk]
                status = client.post(text, media_ids, args.visibility, args.sensitive)
                ids.append(status["id"])
                print(f"    ✓ {status.get('url') or status['id']}")
                time.sleep(args.delay)
        except Exception as e:
            print(f"    ✗ {e}", file=sys.stderr)
            failed += 1
            if ids:  # partially posted album: remember what went up so it isn't duplicated
                state[p.key] = {"status_ids": ids, "partial": True}
                save_state(args.state, state)
            continue

        if not args.dry_run:
            state[p.key] = {"status_ids": ids}
            save_state(args.state, state)

    print(f"\ndone, {failed} failed" + (" (dry run)" if args.dry_run else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
