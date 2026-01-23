from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "edricd-fastapi"
    APP_VERSION: str = "0.1.0"

    # 逗号分隔字符串： "http://edricd.com,http://www.edricd.com,https://edricd.com"
    CORS_ALLOW_ORIGINS: str = Field(default="")

    # SMTP (for contact form email)
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM: str = Field(default="")  # if empty, fallback to SMTP_USER

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def cors_allow_origins_list(self) -> List[str]:
        return [x.strip() for x in self.CORS_ALLOW_ORIGINS.split(",") if x.strip()]
    

    

settings = Settings()
