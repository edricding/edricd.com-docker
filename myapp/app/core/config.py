from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "edricd-fastapi"
    APP_VERSION: str = "0.1.0"

    # 用逗号分隔： "http://edricd.com,http://www.edricd.com,https://edricd.com"
    CORS_ALLOW_ORIGINS: str = Field(default="")

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_allow_origins_list(self) -> List[str]:
        return [x.strip() for x in self.CORS_ALLOW_ORIGINS.split(",") if x.strip()]

settings = Settings()
