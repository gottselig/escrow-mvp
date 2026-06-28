// Utility functions
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatEther, formatUnits, isAddress, parseEther, parseUnits } from 'viem'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortAddress(address?: string) {
  if (!address) return 'Not connected'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function isEthToken(token?: `0x${string}` | string | null) {
  return !token || token === '0x0000000000000000000000000000000000000000'
}

export function paymentSymbol(token?: `0x${string}` | string | null) {
  return isEthToken(token) ? 'ETH' : 'mUSDC'
}

export function paymentDecimals(token?: `0x${string}` | string | null) {
  return isEthToken(token) ? 18 : 6
}

export function parsePaymentAmount(value: string, token?: `0x${string}` | string | null) {
  return isEthToken(token) ? parseEther(value) : parseUnits(value, 6)
}

export function formatPaymentAmount(value?: bigint, token?: `0x${string}` | string | null) {
  if (value === undefined) return '0'
  return isEthToken(token) ? formatEther(value) : formatUnits(value, 6)
}

export function formatUnixTimestamp(value?: bigint) {
  if (value === undefined) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(Number(value) * 1000))
}

export function addressOrZero(value?: string) {
  return value && isAddress(value) ? (value as `0x${string}`) : '0x0000000000000000000000000000000000000000'
}
