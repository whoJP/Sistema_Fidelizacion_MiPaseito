// Mirror of backend/prisma/schema.prisma. Dates are ISO strings, Decimals are numbers.
import type { TIER_ICON_KEYS } from '../domain/validation'

export type UserRole = 'CUSTOMER' | 'MERCHANT' | 'ADMIN'
export type UserStatus = 'ACTIVE' | 'SUSPENDED'
export type BusinessStatus = 'ACTIVE' | 'INACTIVE'
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'
export type BusinessMemberRole = 'STAFF' | 'MANAGER'
export type BusinessMemberStatus = 'ACTIVE' | 'INACTIVE'
export type CategoryStatus = 'ACTIVE' | 'INACTIVE'
export type TransactionStatus = 'COMPLETED' | 'CANCELLED' | 'FLAGGED'
export type PointMovementType =
  | 'PURCHASE'
  | 'MISSION'
  | 'PROMOTION'
  | 'EVENT'
  | 'REDEMPTION'
  | 'ADJUSTMENT'
  | 'REVERSAL'
  | 'CHECK_IN'
  | 'SPIN'
  | 'BIRTHDAY'
  | 'EXPIRATION'
export type StatusMovementType = 'PURCHASE' | 'MISSION' | 'DISCOVERY' | 'STREAK' | 'ADJUSTMENT' | 'WELCOME' | 'CHECK_IN'
export type RewardType = 'PERCENT_DISCOUNT' | 'AMOUNT_DISCOUNT' | 'FREE_PRODUCT'
export type RewardStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type RedemptionStatus = 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED'
export type RedemptionOrigin = 'POINTS' | 'PRIZE' | 'BIRTHDAY'
export type MissionType =
  | 'BUY_DISTINCT_BUSINESSES'
  | 'BUY_CATEGORY'
  | 'BUY_DISTINCT_CATEGORIES'
  | 'TOTAL_PURCHASE_AMOUNT'
  | 'TRANSACTION_COUNT'
  | 'WEEKLY_PURCHASE'
  | 'DISCOVER_BUSINESS'
export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type PromotionType = 'POINTS_MULTIPLIER' | 'FIXED_POINTS'
export type PromotionStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type PromotionOrigin = 'MANUAL' | 'REACTIVATION' | 'ANNIVERSARY' | 'VISIT_CARD' | 'PRIZE'
export type EventStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'
export type BadgeType =
  | 'TIER_REACHED'
  | 'PURCHASE_COUNT'
  | 'CATEGORY_PURCHASES'
  | 'DISTINCT_BUSINESSES'
  | 'MISSIONS_COMPLETED'
  | 'SPECIAL_DATE'
export type BadgeStatus = 'ACTIVE' | 'INACTIVE'
export type FraudAlertType =
  | 'DUPLICATE_TRANSACTION'
  | 'REUSED_REDEMPTION'
  | 'HIGH_FREQUENCY'
  | 'ABNORMAL_AMOUNT'
  | 'CHECK_IN_ONLY'
export type FraudAlertStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED'
export type CancellationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type SpaceStatus = 'ACTIVE' | 'INACTIVE'
export type SpinSource = 'DAILY' | 'EXTRA' | 'FREE'
export type SpinPrizeType = 'POINTS' | 'MULTIPLIER' | 'REWARD' | 'EXTRA_SPIN'
export type SpinPrizeStatus = 'ACTIVE' | 'INACTIVE'
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  phone: string | null
  /** `YYYY-MM-DD`, only set once the admin approves the customer's verification (KycRequest). */
  birthDate: string | null
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Business {
  id: number
  name: string
  description: string
  logoUrl: string | null
  phone: string | null
  floor: string | null
  sector: string | null
  localNumber: string | null
  status: BusinessStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface BusinessSchedule {
  id: number
  businessId: number
  dayOfWeek: DayOfWeek
  openTime: string | null
  closeTime: string | null
  isClosed: boolean
}

export interface BusinessMember {
  id: number
  userId: number
  businessId: number
  role: BusinessMemberRole
  status: BusinessMemberStatus
}

export interface Category {
  id: number
  name: string
  parentId: number | null
  status: CategoryStatus
  deletedAt: string | null
}

export interface BusinessCategory {
  businessId: number
  categoryId: number
}

export interface CatalogItem {
  id: number
  businessId: number
  name: string
  description: string | null
  price: number
  isAvailable: boolean
  deletedAt: string | null
}

export interface Tier {
  id: number
  name: string
  minimumStatus: number
  pointsMultiplier: number
  sortOrder: number
  isActive: boolean
  icon: TierIconKey
}

export type TierIconKey = (typeof TIER_ICON_KEYS)[number]

export interface Transaction {
  id: number
  customerId: number
  businessId: number
  performedById: number
  amount: number
  status: TransactionStatus
  createdAt: string
}

export interface TransactionItem {
  id: number
  transactionId: number
  catalogItemId: number
  quantity: number
  /** Catalog price when the purchase was registered. */
  unitPrice: number
}

export interface CancellationRequest {
  id: number
  transactionId: number
  requestedById: number
  reason: string
  status: CancellationRequestStatus
  reviewedById: number | null
  /** Admin's reason: shown to the customer when approved, to the manager when rejected. */
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface Notification {
  id: number
  userId: number
  title: string
  message: string
  createdAt: string
  readAt: string | null
}

export interface PointMovement {
  id: number
  userId: number
  transactionId: number | null
  redemptionId: number | null
  missionId: number | null
  promotionId: number | null
  eventId: number | null
  checkInId: number | null
  spinId: number | null
  type: PointMovementType
  amount: number
  createdAt: string
}

export interface StatusMovement {
  id: number
  userId: number
  transactionId: number | null
  missionId: number | null
  checkInId: number | null
  type: StatusMovementType
  amount: number
  createdAt: string
}

export interface Reward {
  id: number
  businessId: number
  type: RewardType
  discountPercent: number | null
  discountAmount: number | null
  catalogItemId: number | null
  quantity: number
  minimumPurchase: number | null
  description: string | null
  pointsCost: number
  minimumTierId: number | null
  stock: number | null
  startsAt: string | null
  endsAt: string | null
  status: RewardStatus
  createdById: number
  deletedAt: string | null
}

export interface Redemption {
  id: number
  userId: number
  rewardId: number
  businessId: number | null
  validatedById: number | null
  pointsSpent: number
  verificationToken: string
  status: RedemptionStatus
  /** POINTS: code valid for minutes. PRIZE (ruleta) and BIRTHDAY are free and valid until `expiresAt`. */
  origin: RedemptionOrigin
  expiresAt: string | null
  createdAt: string
  redeemedAt: string | null
}

export interface Mission {
  id: number
  name: string
  description: string | null
  type: MissionType
  goal: number
  rewardPoints: number
  rewardStatus: number
  /** Free ruleta spins granted on completion. */
  rewardSpins: number
  startsAt: string
  endsAt: string
  status: MissionStatus
  createdById: number
  deletedAt: string | null
}

export interface MissionBusiness {
  missionId: number
  businessId: number
}

export interface MissionCategory {
  missionId: number
  categoryId: number
}

export interface MissionProgress {
  missionId: number
  userId: number
  progress: number
  completedAt: string | null
}

export interface BusinessDiscovery {
  userId: number
  businessId: number
  discoveredAt: string
}

export interface Promotion {
  id: number
  name: string
  type: PromotionType
  value: number
  startsAt: string
  endsAt: string
  status: PromotionStatus
  /** null = for every customer; set = personal promotion created automatically for that customer. */
  userId: number | null
  origin: PromotionOrigin
  /** Applies to a single purchase (cupón de regreso, ruleta prize). */
  singleUse: boolean
  createdById: number
  deletedAt: string | null
}

export interface PromotionBusiness {
  promotionId: number
  businessId: number
}

export interface PromotionCategory {
  promotionId: number
  categoryId: number
}

/** Prisma model `Event` (renamed here to avoid shadowing the DOM `Event`). */
export interface PaseoEvent {
  id: number
  name: string
  description: string | null
  location: string | null
  startsAt: string
  endsAt: string
  pointsReward: number
  status: EventStatus
  createdById: number
  deletedAt: string | null
}

export interface EventAttendance {
  eventId: number
  userId: number
  checkedInById: number
  checkedInAt: string
}

export interface Badge {
  id: number
  name: string
  description: string | null
  type: BadgeType
  goal: number | null
  tierId: number | null
  categoryId: number | null
  /** `YYYY-MM-DD`, only for SPECIAL_DATE. */
  date: string | null
  status: BadgeStatus
  createdById: number
  deletedAt: string | null
}

export interface FraudAlert {
  id: number
  transactionId: number | null
  redemptionId: number | null
  checkInId: number | null
  type: FraudAlertType
  riskScore: number
  status: FraudAlertStatus
  createdAt: string
}

export interface AuditLog {
  id: number
  userId: number
  action: string
  entityType: string
  entityId: number
  createdAt: string
}

export interface SystemSetting {
  key: string
  value: string
  updatedAt: string
}

/** Place of the Paseo with a fixed QR (`code`, hidden from non-admin snapshots). */
export interface Space {
  id: number
  name: string
  description: string | null
  location: string | null
  code: string
  pointsReward: number
  statusReward: number
  status: SpaceStatus
  createdById: number
  createdAt: string
  deletedAt: string | null
}

export interface SpaceCheckIn {
  id: number
  spaceId: number
  userId: number
  /** Bolivian calendar day `YYYY-MM-DD`. */
  day: string
  createdAt: string
}

export interface SpinPrize {
  id: number
  type: SpinPrizeType
  points: number | null
  multiplier: number | null
  rewardId: number | null
  validDays: number
  weight: number
  stock: number | null
  status: SpinPrizeStatus
  createdById: number
  deletedAt: string | null
}

export interface Spin {
  id: number
  userId: number
  source: SpinSource
  cost: number
  prizeId: number
  prizeType: SpinPrizeType
  points: number
  promotionId: number | null
  redemptionId: number | null
  unlockTransactionId: number | null
  createdAt: string
}

/** The ID photo lives apart (KycDocument) and never travels in the snapshot. */
export interface KycRequest {
  id: number
  userId: number
  /** `YYYY-MM-DD` */
  birthDate: string
  status: KycStatus
  reviewedById: number | null
  reviewNote: string | null
  createdAt: string
  reviewedAt: string | null
}

export interface BirthdayPerk {
  businessId: number
  type: RewardType
  discountPercent: number | null
  discountAmount: number | null
  catalogItemId: number | null
  quantity: number
  description: string | null
  isActive: boolean
  updatedAt: string
}

export interface BirthdayClaim {
  id: number
  userId: number
  businessId: number
  year: number
  transactionId: number
  validatedById: number
  perkTitle: string
  createdAt: string
}

export interface Database {
  users: User[]
  businesses: Business[]
  businessSchedules: BusinessSchedule[]
  businessMembers: BusinessMember[]
  categories: Category[]
  businessCategories: BusinessCategory[]
  catalogItems: CatalogItem[]
  tiers: Tier[]
  transactions: Transaction[]
  transactionItems: TransactionItem[]
  cancellationRequests: CancellationRequest[]
  notifications: Notification[]
  pointMovements: PointMovement[]
  statusMovements: StatusMovement[]
  rewards: Reward[]
  redemptions: Redemption[]
  missions: Mission[]
  missionBusinesses: MissionBusiness[]
  missionCategories: MissionCategory[]
  missionProgress: MissionProgress[]
  businessDiscoveries: BusinessDiscovery[]
  promotions: Promotion[]
  promotionBusinesses: PromotionBusiness[]
  promotionCategories: PromotionCategory[]
  events: PaseoEvent[]
  eventAttendances: EventAttendance[]
  badges: Badge[]
  spaces: Space[]
  spaceCheckIns: SpaceCheckIn[]
  spinPrizes: SpinPrize[]
  spins: Spin[]
  kycRequests: KycRequest[]
  birthdayPerks: BirthdayPerk[]
  birthdayClaims: BirthdayClaim[]
  fraudAlerts: FraudAlert[]
  auditLogs: AuditLog[]
  systemSettings: SystemSetting[]
}
