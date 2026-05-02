from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Request
from starlette.responses import JSONResponse


_BUCKETS: dict[str, deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    if request.client:
        return request.client.host

    return "unknown"


def _rate_config(path: str) -> tuple[int, int]:
    """
    Returns: max_requests, window_seconds
    """

    # Login endpoint is stricter to reduce brute force attempts.
    if path == "/me/simulate-login":
        return 5, 60

    # Normal API calls.
    return 120, 60


async def rate_limit_middleware(request: Request, call_next):
    path = request.url.path

    # Do not rate-limit docs too aggressively during development.
    if path in ("/docs", "/redoc", "/openapi.json"):
        return await call_next(request)

    max_requests, window_seconds = _rate_config(path)

    ip = _client_ip(request)
    key = f"{ip}:{path}"

    now = time.time()
    bucket = _BUCKETS[key]

    while bucket and bucket[0] <= now - window_seconds:
        bucket.popleft()

    if len(bucket) >= max_requests:
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. Please wait before trying again.",
                "rate_limit": {
                    "max_requests": max_requests,
                    "window_seconds": window_seconds,
                },
            },
        )

    bucket.append(now)

    return await call_next(request)