"""python -m sicoob_service ou comando `sicoob-service`."""

from __future__ import annotations

import uvicorn

from sicoob_service.settings import get_settings


def main() -> None:
    s = get_settings()
    uvicorn.run(
        "sicoob_service.app:app",
        host=s.host,
        port=s.port,
        factory=False,
    )


if __name__ == "__main__":
    main()
