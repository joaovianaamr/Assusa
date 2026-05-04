from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    internal_api_key: str = Field(
        default="",
        validation_alias="INTERNAL_API_KEY",
        description="Chave partilhada Node→Python (cabeçalho X-Internal-Api-Key).",
    )

    sicoob_sandbox: bool = Field(default=True, validation_alias="SICOOB_SANDBOX")
    sicoob_client_id: str = Field(default="", validation_alias="SICOOB_CLIENT_ID")

    # Caminhos PEM (como no PHP quando já existem ficheiros)
    sicoob_cert_path: str = Field(default="", validation_alias="SICOOB_CERT_PATH")
    sicoob_key_path: str = Field(default="", validation_alias="SICOOB_KEY_PATH")

    # Alternativa: PKCS#12 (.p12 / .pfx)
    sicoob_p12_path: str = Field(default="", validation_alias="SICOOB_P12_PATH")
    sicoob_p12_password: str = Field(default="", validation_alias="SICOOB_P12_PASSWORD")

    host: str = Field(default="0.0.0.0", validation_alias="SICOOB_SERVICE_HOST")
    port: int = Field(default=8090, validation_alias="SICOOB_SERVICE_PORT")


@lru_cache
def get_settings() -> Settings:
    return Settings()
