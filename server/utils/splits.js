/* server/utils/splits.js */

/**
 * Distributes a total amount in cents equally among a list of member IDs.
 * Handles remainder cents randomly (using Fisher-Yates shuffle) to avoid systematic bias.
 * 
 * @param {number} totalCents - The total amount in cents.
 * @param {Array<number|string>} memberIds - List of member IDs.
 * @returns {Array<{ memberId: number, amount: number }>} Array of split objects with memberId and amount in standard units (e.g. dollars/rupees).
 */
function distributeEqually(totalCents, memberIds) {
  const count = memberIds.length;
  if (count === 0) return [];
  
  const baseShare = Math.floor(totalCents / count);
  const remainder = totalCents % count;

  // Create array of shares
  const shares = memberIds.map(() => baseShare);

  // Randomly distribute remainder cents to avoid systematic bias
  if (remainder > 0) {
    // Shuffle indices using Fisher-Yates
    const indices = memberIds.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Give extra cent to first `remainder` shuffled positions
    for (let i = 0; i < remainder; i++) {
      shares[indices[i]]++;
    }
  }

  return memberIds.map((mId, i) => ({
    memberId: Number(mId),
    amount: shares[i] / 100,
  }));
}

module.exports = {
  distributeEqually,
};
