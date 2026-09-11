from collections.abc import Mapping

import pytest

from app.ai.provider_config import (
    EncryptedProviderConfig,
    ProviderConfigContext,
    ProviderConfigCrypto,
    ProviderConfigError,
    ProviderConfigResolver,
)

SYNTHETIC_KEY_HEX = "11" * 32
SYNTHETIC_API_KEY = "synthetic-provider-key-for-tests"
NODE_AES_GCM_VECTOR = (
    "000102030405060708090a0b.57472e500af846d4a90c5de049dffdf4."
    "609ad86713c6419d7795a3edabd99e42acd32d03700c7f49c692920b9833175d"
)
TENANT_SCOPE = "tenant:00000000-0000-0000-0000-000000000001"


def test_encryption_key_is_required_and_must_be_32_byte_hex() -> None:
    with pytest.raises(ProviderConfigError, match="ENCRYPTION_KEY is required"):
        ProviderConfigCrypto.from_environment({})
    with pytest.raises(ProviderConfigError, match="64 hexadecimal"):
        ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": "not-a-valid-key"})


def test_new_encryption_uses_bound_v2_format() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    encrypted = crypto.encrypt(SYNTHETIC_API_KEY, context=context)

    version, iv_hex, auth_tag_hex, ciphertext_hex = encrypted.split(".")
    assert version == "v2"
    assert len(iv_hex) == 24
    assert len(auth_tag_hex) == 32
    assert ciphertext_hex
    assert SYNTHETIC_API_KEY not in encrypted
    assert crypto.decrypt(encrypted, context=context) == SYNTHETIC_API_KEY


def test_decrypts_synthetic_ciphertext_produced_by_node_crypto() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    assert crypto.decrypt_legacy_v1(NODE_AES_GCM_VECTOR) == SYNTHETIC_API_KEY


@pytest.mark.parametrize("field_name", ["apiKey", "encrypted_api_key"])
def test_resolver_accepts_legacy_and_v2_encrypted_field_names(field_name: str) -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_legacy_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    payload: dict[str, object] = {
        "id": context.config_id,
        "tenantScope": context.tenant_scope,
        "provider": context.provider,
        field_name: NODE_AES_GCM_VECTOR,
        "legacyContextMac": crypto.bind_legacy_v1(NODE_AES_GCM_VECTOR, context=context),
        "baseUrl": "https://synthetic.invalid",
        "model": "synthetic-model",
    }
    encrypted = EncryptedProviderConfig.model_validate(payload)
    resolved = ProviderConfigResolver(crypto).resolve(encrypted)

    assert resolved.provider == "anthropic"
    assert resolved.api_key.get_secret_value() == SYNTHETIC_API_KEY
    assert resolved.base_url == "https://synthetic.invalid"
    assert resolved.model == "synthetic-model"
    assert SYNTHETIC_API_KEY not in repr(resolved)


def test_legacy_ciphertext_transplant_to_another_tenant_fails() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    original = ProviderConfigContext(
        config_id="cfg_legacy_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    transplanted = EncryptedProviderConfig(
        config_id=original.config_id,
        tenant_scope="tenant:00000000-0000-0000-0000-000000000002",
        provider=original.provider,
        encrypted_api_key=NODE_AES_GCM_VECTOR,
        legacy_context_mac=crypto.bind_legacy_v1(NODE_AES_GCM_VECTOR, context=original),
    )

    with pytest.raises(ProviderConfigError, match="credential is invalid"):
        ProviderConfigResolver(crypto).resolve(transplanted)


def test_unbound_legacy_config_fails_closed() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    config = EncryptedProviderConfig(
        provider="anthropic",
        encrypted_api_key=NODE_AES_GCM_VECTOR,
    )

    with pytest.raises(ProviderConfigError, match="bound migration metadata"):
        ProviderConfigResolver(crypto).resolve(config)


def test_resolver_decrypts_bound_config_using_record_identity() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    encrypted = EncryptedProviderConfig(
        config_id=context.config_id,
        tenant_scope=context.tenant_scope,
        provider=context.provider,
        encrypted_api_key=crypto.encrypt(SYNTHETIC_API_KEY, context=context),
    )

    resolved = ProviderConfigResolver(crypto).resolve(encrypted)

    assert resolved.api_key.get_secret_value() == SYNTHETIC_API_KEY


def test_bound_config_without_record_identity_fails_closed() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    encrypted = EncryptedProviderConfig(
        provider=context.provider,
        encrypted_api_key=crypto.encrypt(SYNTHETIC_API_KEY, context=context),
    )

    with pytest.raises(ProviderConfigError, match="requires a config id"):
        ProviderConfigResolver(crypto).resolve(encrypted)


@pytest.mark.parametrize(
    ("config_id", "tenant_scope", "provider"),
    [
        ("cfg_test_002", TENANT_SCOPE, "anthropic"),
        ("cfg_test_001", "tenant:00000000-0000-0000-0000-000000000002", "anthropic"),
        ("cfg_test_001", TENANT_SCOPE, "openai"),
    ],
)
def test_bound_ciphertext_transplant_to_another_config_tenant_or_provider_fails(
    config_id: str,
    tenant_scope: str,
    provider: str,
) -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    original_context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    encrypted = crypto.encrypt(SYNTHETIC_API_KEY, context=original_context)
    transplanted = EncryptedProviderConfig(
        config_id=config_id,
        tenant_scope=tenant_scope,
        provider=provider,
        encrypted_api_key=encrypted,
    )

    with pytest.raises(ProviderConfigError, match="credential is invalid"):
        ProviderConfigResolver(crypto).resolve(transplanted)


def test_aad_context_serialization_has_no_delimiter_ambiguity() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    original = ProviderConfigContext(
        config_id="config\x00anthropic", tenant_scope=TENANT_SCOPE, provider="tenant"
    )
    ambiguous_under_delimiter_join = ProviderConfigContext(
        config_id="config",
        tenant_scope=TENANT_SCOPE,
        provider="anthropic\x00tenant",
    )
    encrypted = crypto.encrypt(SYNTHETIC_API_KEY, context=original)

    with pytest.raises(ProviderConfigError, match="credential is invalid"):
        crypto.decrypt(encrypted, context=ambiguous_under_delimiter_join)


def test_bound_and_legacy_read_paths_are_not_ambiguous() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    bound = crypto.encrypt(SYNTHETIC_API_KEY, context=context)

    with pytest.raises(ProviderConfigError):
        crypto.decrypt(NODE_AES_GCM_VECTOR, context=context)
    with pytest.raises(ProviderConfigError):
        crypto.decrypt_legacy_v1(bound)


def test_tampered_ciphertext_fails_without_exposing_secret_or_payload() -> None:
    crypto = ProviderConfigCrypto.from_environment({"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX})
    context = ProviderConfigContext(
        config_id="cfg_test_001", tenant_scope=TENANT_SCOPE, provider="anthropic"
    )
    encrypted = crypto.encrypt(SYNTHETIC_API_KEY, context=context)
    tampered = encrypted[:-1] + ("0" if encrypted[-1] != "0" else "1")

    with pytest.raises(ProviderConfigError) as caught:
        crypto.decrypt(tampered, context=context)

    message = str(caught.value)
    assert SYNTHETIC_API_KEY not in message
    assert tampered not in message


def test_environment_mapping_is_not_retained() -> None:
    environment: Mapping[str, str] = {"ENCRYPTION_KEY": SYNTHETIC_KEY_HEX}
    crypto = ProviderConfigCrypto.from_environment(environment)
    assert not hasattr(crypto, "environment")
