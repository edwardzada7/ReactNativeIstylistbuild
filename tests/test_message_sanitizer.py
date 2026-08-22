from backend.utils.message_sanitizer import MessageType, sanitizeMessagePayload


def test_masks_nigerian_phone_and_preserves_original():
    payload = sanitizeMessagePayload("Call 0 8 0 3 1 2 3 4 5 6 7")

    assert payload["is_masked"] is True
    assert payload["original_content"] == "Call 0 8 0 3 1 2 3 4 5 6 7"
    assert "Contact Info Masked" in payload["content"]
    assert payload["message_type"] == MessageType.TEXT.value


def test_masks_external_payment_details():
    payload = sanitizeMessagePayload("Pay directly to my OPay account 1234567890")

    assert payload["is_masked"] is True
    assert "Contact Info Masked" in payload["content"]


def test_leaves_normal_text_unchanged():
    payload = sanitizeMessagePayload("Thanks for confirming my appointment")

    assert payload["is_masked"] is False
    assert payload["content"] == "Thanks for confirming my appointment"
    assert payload["original_content"] is None
