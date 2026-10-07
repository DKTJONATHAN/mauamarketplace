import { describe, expect, it } from 'vitest';
import { scanMessage } from '../src/lib/safety';

const ids = (text: string) => scanMessage(text).map((f) => f.id);

describe('scanMessage', () => {
  it('flags requests for money before meeting', () => {
    expect(ids('Please send a deposit and I will hold the phone')).toContain('advance-payment');
    expect(ids('tuma pesa kwanza')).toContain('advance-payment');
  });

  it('flags the wrong-transfer story', () => {
    expect(ids('I sent you money by mistake, please send it back')).toContain('wrong-transfer');
  });

  it('flags couriers and sellers abroad', () => {
    expect(ids('I am abroad so my agent will pick it up')).toContain('shipping');
    expect(ids('pay the delivery fee first')).toContain('shipping');
  });

  it('flags links and secret codes', () => {
    expect(ids('open https://bit.ly/abc to confirm')).toContain('link');
    expect(ids('tell me the OTP you received')).toContain('secret-codes');
  });

  it('leaves ordinary haggling alone', () => {
    expect(scanMessage('Hi, is the sofa still available? Can we meet at 3pm in Maua town?')).toEqual([]);
    expect(scanMessage('Would you take 20,000?')).toEqual([]);
  });
});
