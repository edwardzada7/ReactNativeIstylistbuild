"""
Anti-Leak Message Sanitizer - Utility to detect and mask sensitive contact information
in chat messages (Nigerian payment patterns, bank accounts, external payment methods, etc.)

Patterns detected:
- Nigerian phone numbers (080, 081, 090, 070, 091, +234, 234)
- NUBAN bank account numbers (10-digit continuous strings)
- Nigerian bank names (OPay, Palmpay, Kuda, GTB, Access, Zenith, etc.)
- External payment keywords (WhatsApp, call me, pay directly, Instagram, etc.)
- Email patterns and domain-like strings (@, .com, etc.)
"""

import re
from typing import Tuple, Dict, Any
from enum import Enum

class MessageType(str, Enum):
    """Supported message types for extended messaging"""
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    LOCATION = "LOCATION"
    CUSTOM_INVOICE = "CUSTOM_INVOICE"
    SYSTEM_ALERT = "SYSTEM_ALERT"
    PROVIDER_RECOMMENDATION = "PROVIDER_RECOMMENDATION"


class MessageSanitizer:
    """Utility class for sanitizing chat messages to prevent payment leakage"""
    
    # Regex patterns for detecting sensitive information
    PATTERNS = {
        'nigerian_phone': r'\b(080|081|090|070|091)\d{7}\b',
        'nigerian_phone_spaced': r'(?<!\d)(?:0[\s\-]?8[\s\-]?0|0[\s\-]?8[\s\-]?1|0[\s\-]?9[\s\-]?0|0[\s\-]?7[\s\-]?0|0[\s\-]?9[\s\-]?1)[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d(?!\d)',
        'international_phone': r'\+234[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}',
        'phone_234_prefix': r'\b234[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{4}\b',
        'nuban_account': r'\b\d{10}\b',  # 10-digit NUBAN numbers
        'bank_names': r'\b(OPay|Palmpay|Kuda|GTB|Access|Zenith|UBA|First\s+Bank|Sterling|FCMB|Fidelity|Ecobank|Stanbic|Union)\b',
        'external_keywords': r'\b(WhatsApp|Telegram|Signal|call\s+me|pay\s+directly|pay\s+cash|send\s+cash|bank\s+transfer|Instagram|Snapchat|Facebook)\b',
        'email_pattern': r'[\w\.\-]+@[\w\.\-]+\.\w{2,}',
        'at_mention': r'@[\w\.\-]+',
        'domain_pattern': r'[\w\-]+\.(com|ng|io|co|org|net)',
    }
    
    REPLACEMENT_MESSAGE = "[Contact Info Masked - Keep payments in-app for protection]"
    
    @staticmethod
    def compile_patterns() -> Dict[str, re.Pattern]:
        """Compile all regex patterns for better performance"""
        return {
            name: re.compile(pattern, re.IGNORECASE)
            for name, pattern in MessageSanitizer.PATTERNS.items()
        }
    
    @classmethod
    def sanitize_message(cls, text: str) -> Tuple[str, bool]:
        """
        Sanitize a message by detecting and masking sensitive contact information.
        
        Args:
            text (str): The message content to sanitize
            
        Returns:
            Tuple[str, bool]: (sanitized_message, was_masked)
                - sanitized_message: The message with sensitive info replaced
                - was_masked: True if any sensitive content was found and masked
        """
        if not text or not isinstance(text, str):
            return text, False
        
        patterns = cls.compile_patterns()
        sanitized = text
        was_masked = False
        
        # Check each pattern for matches
        for pattern_name, pattern in patterns.items():
            # Find all matches
            matches = pattern.finditer(sanitized)
            match_count = len(list(matches))
            
            if match_count > 0:
                was_masked = True
                # Replace all occurrences with the masked message
                sanitized = pattern.sub(cls.REPLACEMENT_MESSAGE, sanitized)
        
        return sanitized, was_masked
    
    @staticmethod
    def detect_sensitive_content(text: str) -> bool:
        """
        Quick check to detect if text contains sensitive contact information
        without actually sanitizing it.
        
        Args:
            text (str): The message content to check
            
        Returns:
            bool: True if sensitive content detected, False otherwise
        """
        patterns = MessageSanitizer.compile_patterns()
        
        for pattern in patterns.values():
            if pattern.search(text):
                return True
        
        return False
    
    @staticmethod
    def create_system_alert_message(original_message: str) -> str:
        """
        Create a system alert message to append when content is masked.
        Explains to users why payments should stay in-app.
        
        Args:
            original_message (str): The masked message
            
        Returns:
            str: A user-friendly system alert message
        """
        return (
            "🔒 Protection Notice: We detected potential payment information in this message. "
            "For your security, all payments must be processed through our in-app payment system. "
            "Never share bank details, account numbers, or contact information outside the app."
        )


def sanitize_chat_message_payload(message_text: str) -> Dict[str, Any]:
    """
    Process a chat message through the anti-leak sanitizer and return
    the payload for database insertion with metadata.
    
    This function should be called in the send_message controller BEFORE
    database insertion.
    
    Args:
        message_text (str): Raw user input message
        
    Returns:
        Dict containing:
            - content: sanitized message text (or original if no sensitive info)
            - is_masked: boolean flag indicating if content was masked
            - original_content: original text if masked, otherwise None
            - message_type: type of message (TEXT by default)
    """
    sanitized_content, was_masked = MessageSanitizer.sanitize_message(message_text)
    
    return {
        'content': sanitized_content,
        'is_masked': was_masked,
        'original_content': message_text if was_masked else None,
        'message_type': MessageType.TEXT.value,
    }


def sanitizeMessagePayload(text: str) -> Dict[str, Any]:
    """Return the persistence payload for a text message."""
    payload = sanitize_chat_message_payload(text)
    return {
        'content': payload['content'],
        'is_masked': payload['is_masked'],
        'original_content': payload['original_content'],
        'message_type': payload['message_type'],
    }


# Unit tests
if __name__ == "__main__":
    print("Running Message Sanitizer Tests...")
    print("-" * 60)
    
    test_cases = [
        ("Hello, my number is 08012345678", True),
        ("Call me on +2348012345678", True),
        ("Send to my OPay wallet", True),
        ("Pay via WhatsApp", True),
        ("My email is test@example.com", True),
        ("Contact @john_doe", True),
        ("Check out example.com", True),
        ("Hello, let's meet tomorrow", False),
        ("Great! See you at 3 PM", False),
        ("Thank you for the booking", False),
    ]
    
    for message, should_mask in test_cases:
        sanitized, was_masked = MessageSanitizer.sanitize_message(message)
        status = "✓" if was_masked == should_mask else "✗"
        print(f"{status} Input: '{message}'")
        print(f"  Masked: {was_masked} (Expected: {should_mask})")
        if was_masked:
            print(f"  Output: '{sanitized}'")
        print()
    
    print("-" * 60)
    print("Tests complete!")
