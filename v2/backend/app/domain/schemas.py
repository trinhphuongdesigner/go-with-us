import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.enums import Permission, Role


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda value: (
            value.split("_")[0] + "".join(part.title() for part in value.split("_")[1:])
        ),
        populate_by_name=True,
        extra="forbid",
        from_attributes=True,
    )


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)


class DemoLoginRequest(ApiModel):
    email: EmailStr


class DemoAccountRead(ApiModel):
    email: EmailStr
    name: str
    title: str
    company_name: str
    role: Role
    initials: str


class DemoAccountListRead(ApiModel):
    items: list[DemoAccountRead]


class SessionUserRead(ApiModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    title: str
    company_name: str
    role: Role
    company_id: uuid.UUID | None
    permissions: list[Permission]
    initials: str


class LoginResponse(ApiModel):
    access_token: str
    token_type: str = "bearer"
    user: SessionUserRead


class MeResponse(ApiModel):
    user: SessionUserRead


class MessageResponse(ApiModel):
    message: str
