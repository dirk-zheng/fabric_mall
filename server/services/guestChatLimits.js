const GUEST_MESSAGE_LIMIT = 10;
const REGISTRATION_PROMPT_AT = 7;

function getGuestChatUsage(sentCount) {
  const normalizedCount = Math.max(0, Number(sentCount) || 0);
  return {
    sentCount: normalizedCount,
    remaining: Math.max(0, GUEST_MESSAGE_LIMIT - normalizedCount),
    registrationSuggested: normalizedCount >= REGISTRATION_PROMPT_AT,
    limitReached: normalizedCount >= GUEST_MESSAGE_LIMIT,
  };
}

module.exports = { GUEST_MESSAGE_LIMIT, REGISTRATION_PROMPT_AT, getGuestChatUsage };
