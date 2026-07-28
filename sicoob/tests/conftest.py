import pytest

from sicoob_service.settings import get_settings


@pytest.fixture(autouse=True)
def env_e_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("INTERNAL_API_KEY", "test-internal-key")
    monkeypatch.setenv("SICOOB_SANDBOX", "true")
    monkeypatch.setenv("SICOOB_CLIENT_ID", "test-client")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
