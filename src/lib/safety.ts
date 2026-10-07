/**
 * Lightweight scam-pattern checks shown as warnings under chat messages.
 * These are heuristics, not proof: they only ever add a caution, they never block a message.
 */
export interface SafetyFlag {
  id: string;
  message: string;
}

interface Rule extends SafetyFlag {
  pattern: RegExp;
}

const rules: Rule[] = [
  {
    id: 'advance-payment',
    pattern: /\b(deposit|advance( payment)?|booking fee|reservation fee|registration fee|pay (me )?first|send (me )?(the )?(money|cash|fare|pesa)|lipa kwanza|tuma (pesa|hela))\b/i,
    message: 'Asking for money before you have seen the item is the most common scam. Do not pay until you have inspected it in person.',
  },
  {
    id: 'wrong-transfer',
    pattern: /(by mistake|wrong number|wrongly|kimakosa)[^.]{0,60}(send|return|refund|reverse|rudisha)|\b(reverse|refund)\b[^.]{0,40}(m-?pesa|transaction|money)/i,
    message: 'A story about money sent to you "by mistake" is a known scam. Check your own M-Pesa balance and statement, not just an SMS, before you send anything back.',
  },
  {
    id: 'payment-sms',
    pattern: /(i (have )?(sent|paid|already paid)|nimekutumia|payment (sent|done|made))[^.]{0,60}(m-?pesa|money|payment|pesa)?|check your (m-?pesa|messages|phone)/i,
    message: 'Do not hand over an item because of an SMS. Fake payment messages are common. Confirm the money in your M-Pesa balance or statement first.',
  },
  {
    id: 'shipping',
    pattern: /\b(courier|shipping fee|delivery fee|send (it )?(via|by) (bus|sacco|courier)|i am (abroad|outside the country|out of (the )?country)|my (agent|driver|rider) will (come|pick))\b/i,
    message: 'People who cannot meet and want to use an agent, courier or delivery fee are often scammers. A local, in-person meet-up is safer.',
  },
  {
    id: 'link',
    pattern: /(https?:\/\/|www\.|bit\.ly\/|t\.me\/|wa\.me\/)\S+/i,
    message: 'Be careful with links. Never enter your M-Pesa PIN, bank details or passwords on a page opened from a chat.',
  },
  {
    id: 'secret-codes',
    pattern: /\b(pin|otp|password|verification code|confirmation code|security code)\b/i,
    message: 'Never share your M-Pesa PIN, bank PIN, passwords or verification codes with anyone.',
  },
];

export function scanMessage(text: string): SafetyFlag[] {
  const flags: SafetyFlag[] = [];
  for (const rule of rules) {
    if (rule.pattern.test(text)) flags.push({ id: rule.id, message: rule.message });
  }
  return flags;
}
