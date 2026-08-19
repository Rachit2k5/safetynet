DISTRESS_KEYWORDS = {
    "help": 3, "scared": 3, "follow": 4, "following": 4, "someone": 2, 
    "unsafe": 3, "lost": 2, "hurt": 3, "emergency": 4, "attack": 4, 
    "threat": 3, "danger": 3, "trapped": 3, "kidnap": 5, "weapon": 5, 
    "gun": 5, "knife": 5
}

NEGATIVE_PATTERNS = ["not safe", "can't move", "don't feel safe", "being followed", "no help", "no one around"]
URGENCY_MARKERS = ["please", "now", "hurry", "quickly", "asap"]

def analyze_message(message: str, user_status: str = "safe"):
    if not message:
        return {"score": 0, "isDistressed": False, "details": {"contradictionFlag": False}}

    msg_lower = message.lower()
    score = 0
    found_keywords = []

    for kw, weight in DISTRESS_KEYWORDS.items():
        if kw in msg_lower:
            score += weight
            found_keywords.append(kw)

    for pat in NEGATIVE_PATTERNS:
        if pat in msg_lower:
            score += 3

    for urg in URGENCY_MARKERS:
        if urg in msg_lower:
            score += 1

    is_distressed = score >= 4
    contradiction_flag = (user_status == "safe" and is_distressed)

    return {
        "score": score,
        "isDistressed": is_distressed,
        "details": {
            "contradictionFlag": contradiction_flag,
            "keywordsFound": found_keywords,
            "calculatedScore": score
        }
    }
