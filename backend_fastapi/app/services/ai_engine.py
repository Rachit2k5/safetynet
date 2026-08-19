import os
import json

def evaluate_threat_assessment(message: str, user_status: str = "safe", is_overdue: bool = False, is_deviated: bool = False) -> dict:
    """
    Evaluates threat levels using structured analysis + deterministic rule-based fallback engine.
    Policy Enforcement: The AI score informs threat intensity, but rule-based engine deterministically validates distress states.
    """
    if not message and not is_overdue and not is_deviated:
        return {
            "threatScore": 0.0,
            "riskLevel": "LOW",
            "isDistressed": False,
            "activateEmergencyWorkflow": False,
            "details": {"reason": "Normal user check-in with no distress markers"}
        }

    msg_lower = (message or "").lower()
    score = 0.0
    detected_keywords = []

    distress_dictionary = {
        "help": 3.0, "scared": 3.0, "following": 4.0, "follow": 3.5, "someone": 2.0,
        "unsafe": 3.0, "lost": 2.0, "hurt": 3.0, "emergency": 4.0, "attack": 5.0,
        "threat": 3.5, "danger": 4.0, "trapped": 4.0, "kidnap": 5.0, "weapon": 5.0,
        "gun": 5.0, "knife": 5.0, "save me": 4.5, "behind me": 3.5
    }

    for kw, weight in distress_dictionary.items():
        if kw in msg_lower:
            score += weight
            detected_keywords.append(kw)

    if is_overdue:
        score += 3.5
    if is_deviated:
        score += 3.0

    is_distressed = score >= 4.0 or "help" in msg_lower or "attack" in msg_lower

    if score >= 6.0:
        risk_level = "CRITICAL"
    elif score >= 4.0:
        risk_level = "HIGH"
    elif score >= 2.0:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # Policy Enforcement: Deterministic rule engine triggers workflow
    activate_workflow = is_distressed or is_overdue

    return {
        "threatScore": round(score, 2),
        "riskLevel": risk_level,
        "isDistressed": is_distressed,
        "activateEmergencyWorkflow": activate_workflow,
        "details": {
            "keywordsFound": detected_keywords,
            "isOverdue": is_overdue,
            "isDeviated": is_deviated,
            "contradictionFlag": (user_status == "safe" and is_distressed)
        }
    }
