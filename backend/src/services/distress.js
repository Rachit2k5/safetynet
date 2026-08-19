const DISTRESS_KEYWORDS = {
  help: 3, scared: 3, follow: 4, following: 4, someone: 2, unsafe: 3, 
  lost: 2, hurt: 3, emergency: 4, attack: 4, threat: 3, danger: 3, 
  trapped: 3, kidnap: 5, weapon: 5, gun: 5, knife: 5
};

const NEGATIVE_PATTERNS = ['not safe', "can't move", "don't feel safe", 'being followed', 'no help', 'no one around'];
const URGENCY_MARKERS = ['please', 'now', 'hurry', 'quickly', 'asap'];

export const analyzeMessage = (message, status = 'safe') => {
  if (!message) return { score: 0, isDistressed: false, keywords_found: [], details: { contradictionFlag: false } };

  const lowerMsg = message.toLowerCase();
  let score = 0;
  let keywords_found = [];

  for (const [kw, weight] of Object.entries(DISTRESS_KEYWORDS)) {
    if (lowerMsg.includes(kw)) {
      score += weight;
      keywords_found.push(kw);
    }
  }

  for (const pattern of NEGATIVE_PATTERNS) {
    if (lowerMsg.includes(pattern)) {
      score += 4;
      keywords_found.push(pattern);
    }
  }

  let hasUrgency = false;
  for (const marker of URGENCY_MARKERS) {
    if (lowerMsg.includes(marker)) {
      hasUrgency = true;
      break;
    }
  }
  if (hasUrgency && score > 0) score += 2;

  const isDistressed = score > 5;
  const contradictionFlag = status === 'safe' && isDistressed;

  return { score, isDistressed, keywords_found, details: { contradictionFlag } };
};