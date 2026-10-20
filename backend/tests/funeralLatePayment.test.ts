import { describe, expect, it } from 'vitest';
import { FUNERAL_CONTRIBUTION_STATUS } from '../src/config/constants.js';
import { latePaymentOutcome } from '../src/services/funeralFundService.js';

// The arithmetic of a late funeral payment (cash a member brings later towards
// the 50 baht they were short on). The database writes around it live in
// recordFuneralLatePaymentTx.
describe('latePaymentOutcome', () => {
  it('clears the contribution when the whole shortfall is paid', () => {
    expect(latePaymentOutcome({ totalPaid: 0, shortfall: 50 }, 50)).toEqual({
      amount: 50,
      totalPaid: 50,
      shortfall: 0,
      status: FUNERAL_CONTRIBUTION_STATUS.COMPLETED,
    });
  });

  it('keeps a partial payment as partially paid with the rest still owed', () => {
    expect(latePaymentOutcome({ totalPaid: 20, shortfall: 30 }, 10)).toEqual({
      amount: 10,
      totalPaid: 30,
      shortfall: 20,
      status: FUNERAL_CONTRIBUTION_STATUS.PARTIALLY_PAID,
    });
  });

  it('works in satang without floating-point leftovers', () => {
    expect(latePaymentOutcome({ totalPaid: 19.9, shortfall: 30.1 }, 30.1)).toMatchObject({
      totalPaid: 50,
      shortfall: 0,
      status: FUNERAL_CONTRIBUTION_STATUS.COMPLETED,
    });
  });

  it('refuses more than is owed, nothing, and an already cleared row', () => {
    expect(() => latePaymentOutcome({ totalPaid: 0, shortfall: 50 }, 50.01)).toThrow('ยอดค้างมีเพียง 50 บาท');
    expect(() => latePaymentOutcome({ totalPaid: 0, shortfall: 50 }, 0)).toThrow('จำนวนเงินต้องมากกว่า 0');
    expect(() => latePaymentOutcome({ totalPaid: 50, shortfall: 0 }, 10)).toThrow('รายการนี้จ่ายครบแล้ว');
  });
});
