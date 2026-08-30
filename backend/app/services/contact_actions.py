OUTCOME_STATUS_MAP = {
    "NO_ANSWER": "CONTACT_ATTEMPTED",
    "WRONG_NUMBER": "CONTACT_ATTEMPTED",
    "CUSTOMER_ENGAGED": "ENGAGED",
    "PROMISE_MADE": "PROMISE_TO_PAY",
    "DISPUTE": "DISPUTED",
    "REFUSES_TO_PAY": "ESCALATED",
}

VALID_CHANNELS = {
    "PHONE",
    "SMS",
    "WHATSAPP",
    "EMAIL",
    "FIELD_VISIT",
    "OTHER",
}

VALID_OUTCOMES = set(OUTCOME_STATUS_MAP.keys())


def validate_contact_channel(channel: str) -> str:
    channel = channel.upper()
    if channel not in VALID_CHANNELS:
        raise ValueError(
            f"Invalid contact channel: {channel}"
        )
    return channel


def validate_contact_outcome(outcome: str) -> str:
    outcome = outcome.upper()
    if outcome not in VALID_OUTCOMES:
        raise ValueError(
            f"Invalid contact outcome: {outcome}"
        )
    return outcome


def determine_case_status(outcome: str) -> str:
    outcome = validate_contact_outcome(outcome)
    return OUTCOME_STATUS_MAP[outcome]
