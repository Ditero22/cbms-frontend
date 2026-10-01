import { expect, test } from '@playwright/test'
import {
  formatPeso,
  formatQuantity,
  fromMinorUnits,
  isPositiveDecimal,
  remainingRefundCents,
  remainingReturnMilli,
  toMinorUnits,
} from '../../src/features/modules/order-decimals'

test('refund availability is calculated in exact cents', () => {
  const remaining = remainingRefundCents('0.30', [
    { amount: '0.10', status: 'Processed' },
    { amount: '0.10', status: 'Approved' },
    { amount: '0.05', status: 'Rejected' },
  ])

  expect(remaining).toBe(10n)
  expect(fromMinorUnits(remaining, 2)).toBe('0.10')
  expect(remainingRefundCents('1.00', [{ amount: '1.00', status: 'Requested' }])).toBe(0n)
})

test('return availability includes pending returns in exact milliunits', () => {
  const remaining = remainingReturnMilli('1.000', [
    { quantity: '0.125', status: 'Received' },
    { quantity: '0.250', status: 'Approved' },
    { quantity: '0.125', status: 'Rejected' },
  ])

  expect(remaining).toBe(625n)
  expect(fromMinorUnits(remaining, 3)).toBe('0.625')
})

test('decimal parsing rejects extra precision and formats large values without Number rounding', () => {
  expect(toMinorUnits('99999999999999.99', 2)).toBe(9999999999999999n)
  expect(formatPeso('99999999999999.99')).toBe('₱99,999,999,999,999.99')
  expect(formatPeso('-0.01')).toBe('-₱0.01')
  expect(formatQuantity('12345678901234.567')).toBe('12,345,678,901,234.567')
  expect(formatQuantity('-0.125')).toBe('-0.125')
  expect(isPositiveDecimal('1.001', 3)).toBe(true)
  expect(isPositiveDecimal('1.0001', 3)).toBe(false)
  expect(isPositiveDecimal('0.00', 2)).toBe(false)
})
