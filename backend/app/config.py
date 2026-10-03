from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///./dev.db"
    cleaning_rules_path: str = "/config/cleaning_rules.yaml"


settings = Settings()
