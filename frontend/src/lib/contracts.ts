import type { Address } from 'viem'

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

export const escrowFactoryAddress = (process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS || ZERO_ADDRESS) as Address
export const escrowFactoryDeployBlock = BigInt(process.env.NEXT_PUBLIC_ESCROW_FACTORY_DEPLOY_BLOCK || '0')
export const mosUsdcAddress = (process.env.NEXT_PUBLIC_MOS_USDC_ADDRESS || ZERO_ADDRESS) as Address

export const dealStatusLabels = [
  'Created',
  'Accepted',
  'Funded',
  'In Progress',
  'Disputed',
  'Resolved',
  'Completed',
  'Cancelled',
] as const

export const milestoneStatusLabels = ['Pending', 'Submitted', 'Approved', 'Refunded'] as const

export const escrowFactoryAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'allowedToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'mosUSDC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'defaultArbiter',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'feeBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint96' }],
  },
  {
    type: 'function',
    name: 'treasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isNativePayment',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getAllEscrows',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'feeBalance',
    stateMutability: 'view',
    inputs: [{ name: 'paymentToken', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setPaymentToken',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'newToken', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawFees',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'paymentToken', type: 'address' }],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createEscrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'contractor', type: 'address' },
      { name: 'arbiter', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      {
        name: 'milestones',
        type: 'tuple[]',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'descriptionURI', type: 'string' },
        ],
      },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'escrow', type: 'address' }],
  },
  {
    type: 'event',
    name: 'EscrowCreated',
    anonymous: false,
    inputs: [
      { indexed: true, name: 'escrow', type: 'address' },
      { indexed: true, name: 'client', type: 'address' },
      { indexed: true, name: 'contractor', type: 'address' },
      { indexed: false, name: 'arbiter', type: 'address' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'totalAmount', type: 'uint256' },
      { indexed: false, name: 'metadataURI', type: 'string' },
    ],
  },
] as const

export const escrowAbi = [
  { type: 'function', name: 'client', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'contractor', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'arbiter', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'treasury', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'totalAmount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'fundedAmount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'releasedAmount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'feeBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint96' }] },
  { type: 'function', name: 'status', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'metadataURI', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'disputeReasonURI', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'isNativePayment', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'remainingBalance', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'currentMilestoneId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getMilestonesCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'getMilestone',
    stateMutability: 'view',
    inputs: [{ name: 'milestoneId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'status', type: 'uint8' },
          { name: 'descriptionURI', type: 'string' },
          { name: 'resultURI', type: 'string' },
        ],
      },
    ],
  },
  { type: 'function', name: 'acceptDeal', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'updateDeal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'newTotalAmount', type: 'uint256' },
      {
        name: 'milestoneInputs',
        type: 'tuple[]',
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'deadline', type: 'uint64' },
          { name: 'descriptionURI', type: 'string' },
        ],
      },
      { name: 'newMetadataURI', type: 'string' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'fund', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'cancelBeforeFunding', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'submitMilestone',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'milestoneId', type: 'uint256' },
      { name: 'resultURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approveMilestone',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'milestoneId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'openDispute',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'reasonURI', type: 'string' }],
    outputs: [],
  },
  { type: 'function', name: 'resolveToClient', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  { type: 'function', name: 'resolveToContractor', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'resolveSplit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'clientAmount', type: 'uint256' },
      { name: 'contractorAmount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export const erc20Abi = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
