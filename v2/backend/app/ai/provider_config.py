from __future__ import annotations

import hashlib
import hmac
import json
import os
from collections.abc import Mapping

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from pydantic import AliasChoices, ConfigDict, Field, SecretStr

from .gateway import StrictModel

KEY_BYTES = 32
IV_BYTES = 12
AUTH_TAG_BYTES = 16
BOUND_FORMAT = "v2"
AAD_DOMAIN = "careermate:ai-provider-config:v2"
LEGACY_BINDING_DOMAIN = b"careermate:ai-provider-config:legacy-binding:v1"


class ProviderConfigError(ValueError):
    """Configuration error safe to surface without secret material."""


class EncryptedProviderConfig(StrictModel):
    """Read-compatible shape for the v1 Prisma ``AiProviderConfig`` record."""

    model_config = ConfigDict(extra="forbid", strict=True, populate_by_name=True)

    config_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=191,
        validation_alias=AliasChoices("config_id", "id"),
    )
    tenant_scope: str | None = Field(
        default=None,
        min_length=1,
        max_length=191,
        validation_alias=AliasChoices("tenant_scope", "tenantScope"),
    )
    legacy_context_mac: str | None = Field(
        default=None,
        pattern=r"^[0-9a-f]{64}$",
        validation_alias=AliasChoices("legacy_context_mac", "legacyContextMac"),
    )
    provider: str = Field(min_length=1, max_length=50)
    encrypted_api_key: str = Field(
        min_length=1,
        validation_alias=AliasChoices("encrypted_api_key", "apiKey"),
    )
    base_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("base_url", "baseUrl"),
    )
    model: str | None = Field(default=None, max_length=100)


class ResolvedProviderConfig(StrictModel):
    provider: str
    api_key: SecretStr
    base_url: str | None = None
    model: str | None = None


class ProviderConfigContext(StrictModel):
    """Immutable record identity authenticated alongside a newly encrypted credential."""

    config_id: str = Field(min_length=1, max_length=191)
    tenant_scope: str = Field(min_length=1, max_length=191)
    provider: str = Field(min_length=1, max_length=50)


class ProviderConfigCrypto:
    """AES-256-GCM with bound v2 writes and explicit v1 read compatibility."""

    def __init__(self, key: bytes) -> None:
        if len(key) != KEY_BYTES:
            raise ProviderConfigError("ENCRYPTION_KEY must decode to exactly 32 bytes")
        self._cipher = AESGCM(key)
        self._legacy_binding_key = hmac.new(
            key,
            LEGACY_BINDING_DOMAIN,
            hashlib.sha256,
        ).digest()

    @classmethod
    def from_environment(cls, environment: Mapping[str, str] | None = None) -> ProviderConfigCrypto:
        source = os.environ if environment is None else environment
        encoded_key = source.get("ENCRYPTION_KEY")
        if not encoded_key:
            raise ProviderConfigError("ENCRYPTION_KEY is required")
        if len(encoded_key) != KEY_BYTES * 2:
            raise ProviderConfigError("ENCRYPTION_KEY must contain 64 hexadecimal characters")
        try:
            key = bytes.fromhex(encoded_key)
        except ValueError as exc:
            raise ProviderConfigError(
                "ENCRYPTION_KEY must contain 64 hexadecimal characters"
            ) from exc
        return cls(key)

    def encrypt(self, plaintext: str, *, context: ProviderConfigContext) -> str:
        if not plaintext:
            raise ProviderConfigError("Provider credential must not be empty")
        iv = os.urandom(IV_BYTES)
        ciphertext_and_tag = self._cipher.encrypt(
            iv,
            plaintext.encode("utf-8"),
            _config_aad(context),
        )
        ciphertext = ciphertext_and_tag[:-AUTH_TAG_BYTES]
        auth_tag = ciphertext_and_tag[-AUTH_TAG_BYTES:]
        return f"{BOUND_FORMAT}.{iv.hex()}.{auth_tag.hex()}.{ciphertext.hex()}"

    def decrypt(self, encoded: str, *, context: ProviderConfigContext) -> str:
        """Decrypt a v2 value only when its immutable record context matches."""

        try:
            version, iv_hex, auth_tag_hex, ciphertext_hex = encoded.split(".")
            if version != BOUND_FORMAT:
                raise ValueError
            iv = bytes.fromhex(iv_hex)
            auth_tag = bytes.fromhex(auth_tag_hex)
            ciphertext = bytes.fromhex(ciphertext_hex)
            if len(iv) != IV_BYTES or len(auth_tag) != AUTH_TAG_BYTES or not ciphertext:
                raise ValueError
            plaintext = self._cipher.decrypt(
                iv,
                ciphertext + auth_tag,
                _config_aad(context),
            )
            return plaintext.decode("utf-8")
        except (InvalidTag, UnicodeDecodeError, ValueError) as exc:
            raise ProviderConfigError("Encrypted provider credential is invalid") from exc

    def decrypt_legacy_v1(self, encoded: str) -> str:
        """Read the exact unbound v1 ``iv.authTag.ciphertext`` migration format."""

        try:
            iv_hex, auth_tag_hex, ciphertext_hex = encoded.split(".")
            iv = bytes.fromhex(iv_hex)
            auth_tag = bytes.fromhex(auth_tag_hex)
            ciphertext = bytes.fromhex(ciphertext_hex)
            if len(iv) != IV_BYTES or len(auth_tag) != AUTH_TAG_BYTES or not ciphertext:
                raise ValueError
            plaintext = self._cipher.decrypt(iv, ciphertext + auth_tag, None)
            return plaintext.decode("utf-8")
        except (InvalidTag, UnicodeDecodeError, ValueError) as exc:
            raise ProviderConfigError("Encrypted provider credential is invalid") from exc

    def bind_legacy_v1(self, encoded: str, *, context: ProviderConfigContext) -> str:
        """Bind copied v1 ciphertext to migration metadata without decrypting the secret."""

        return hmac.new(
            self._legacy_binding_key,
            _config_aad(context) + b"\x00" + encoded.encode("ascii"),
            hashlib.sha256,
        ).hexdigest()

    def verify_legacy_v1_binding(
        self,
        encoded: str,
        context_mac: str,
        *,
        context: ProviderConfigContext,
    ) -> None:
        expected = self.bind_legacy_v1(encoded, context=context)
        if not hmac.compare_digest(expected, context_mac):
            raise ProviderConfigError("Encrypted provider credential is invalid")


class ProviderConfigResolver:
    def __init__(self, crypto: ProviderConfigCrypto) -> None:
        self._crypto = crypto

    def resolve(self, config: EncryptedProviderConfig) -> ResolvedProviderConfig:
        if config.encrypted_api_key.startswith(f"{BOUND_FORMAT}."):
            if config.config_id is None or config.tenant_scope is None:
                raise ProviderConfigError(
                    "Bound provider credential requires a config id and tenant scope"
                )
            plaintext = self._crypto.decrypt(
                config.encrypted_api_key,
                context=ProviderConfigContext(
                    config_id=config.config_id,
                    tenant_scope=config.tenant_scope,
                    provider=config.provider,
                ),
            )
        else:
            if (
                config.config_id is None
                or config.tenant_scope is None
                or config.legacy_context_mac is None
            ):
                raise ProviderConfigError(
                    "Legacy provider credential requires bound migration metadata"
                )
            context = ProviderConfigContext(
                config_id=config.config_id,
                tenant_scope=config.tenant_scope,
                provider=config.provider,
            )
            self._crypto.verify_legacy_v1_binding(
                config.encrypted_api_key,
                config.legacy_context_mac,
                context=context,
            )
            plaintext = self._crypto.decrypt_legacy_v1(config.encrypted_api_key)
        return ResolvedProviderConfig(
            provider=config.provider,
            api_key=SecretStr(plaintext),
            base_url=config.base_url,
            model=config.model,
        )


def _config_aad(context: ProviderConfigContext) -> bytes:
    canonical_context = json.dumps(
        context.model_dump(mode="json"),
        ensure_ascii=True,
        separators=(",", ":"),
        sort_keys=True,
    )
    return f"{AAD_DOMAIN}\x00{canonical_context}".encode()
