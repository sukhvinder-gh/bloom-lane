// ============================================================
// CORE ENUMS
// ============================================================

export type UserRole = 'admin' | 'farmer' | 'buyer_b2b' | 'buyer_b2c'

export type OrderStatus =
  | 'pending_payment'
  | 'payment_confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'disputed'
  | 'resolved'
  | 'refunded'
  | 'cancelled'

export type FulfillmentType = 'direct_delivery' | 'hub_pickup'

export type FarmerStatus = 'pending_approval' | 'approved' | 'suspended'

export type ProductCategory =
  | 'flowers_cut'
  | 'flowers_dried'
  | 'flowers_native'
  | 'foliage'
  | 'vegetables'
  | 'herbs'
  | 'fruit'
  | 'eggs'
  | 'honey'
  | 'other'

// ============================================================
// DATABASE ENTITIES
// ============================================================

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  created_at: string
  updated_at: string
}

export interface Farmer {
  id: string
  user_id: string
  business_name: string
  abn: string
  abn_verified: boolean
  abn_verification_status: 'pending' | 'verified' | 'failed'
  brand_color: string
  banner_url?: string
  logo_url?: string
  bio?: string
  address: string
  suburb: string
  state: string
  postcode: string
  delivery_zones: string[] // postcodes
  commission_rate: number // e.g. 0.10 for 10%
  stripe_account_id?: string
  stripe_onboarding_complete: boolean
  gst_registered: boolean // may this grower legally charge GST?
  rcti_agreed: boolean    // has the grower agreed to platform-issued RCTIs?
  offers_farm_pickup: boolean
  status: FarmerStatus
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  farmer_id: string
  farmer?: Farmer
  name: string
  description?: string
  category: ProductCategory
  unit: string // 'bunch', 'kg', 'each', 'tray'
  wholesale_price: number // ex-GST, in AUD cents
  b2c_markup_pct: number // e.g. 0.45 for 45%
  stock_total: number
  b2b_reserved: number // 80% of stock_total
  b2c_reserved: number // 20% of stock_total
  b2b_available: number
  b2c_available: number
  min_order_b2b: number
  stems_per_unit?: number | null
  color_tags: string[]
  common_name?: string
  latin_name?: string
  is_gst_free: boolean
  is_active: boolean
  is_listed_this_week: boolean
  image_url?: string
  image_urls?: string[]
  created_at: string
  updated_at: string
}

export interface DeliveryZone {
  id: string
  name: string
  postcodes: string[]
  hub_address?: string
  hub_collection_day: string // 'wednesday', 'thursday' etc
  hub_collection_time_start: string // '08:00'
  hub_collection_time_end: string // '17:00'
  delivery_fee_cents: number
  is_active: boolean
}

export interface Order {
  id: string
  buyer_id: string
  buyer?: Profile
  order_number: string
  status: OrderStatus
  fulfillment_type: FulfillmentType
  delivery_address?: string
  hub_id?: string
  hub?: DeliveryZone
  subtotal_cents: number
  delivery_fee_cents: number
  gst_cents: number
  total_cents: number
  stripe_payment_intent_id?: string
  qr_code_url?: string
  notes?: string
  delivered_at?: string
  dispute_deadline?: string // T+6hrs from delivered_at
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product?: Product
  farmer_id: string
  farmer?: Farmer
  quantity: number
  unit_price_cents: number // price at time of purchase
  subtotal_cents: number
  is_b2b: boolean
  gst_applied: boolean // was GST charged on this line? (grower registered + product not gst_free)
  gst_cents: number    // GST component included in subtotal_cents, snapshot at purchase
  ppod_url?: string
  ppod_gps_lat?: number
  ppod_gps_lng?: number
  ppod_timestamp?: string
  created_at: string
}

export interface Payout {
  id: string
  farmer_id: string
  order_item_ids: string[]
  gross_amount_cents: number
  commission_cents: number
  adjustment_cents: number // clawback from prior credit notes/refunds, deducted before net
  net_amount_cents: number
  stripe_transfer_id?: string
  status: 'pending' | 'processing' | 'paid' | 'failed'
  paid_at?: string
  created_at: string
}

export interface Config {
  id: string
  key: string
  value: string
  description?: string
  updated_at: string
}

// ============================================================
// APP CONFIG (loaded from Config table)
// ============================================================

export interface AppConfig {
  markup_pct_b2c: number          // 0.45
  min_order_b2b_cents: number     // e.g. 5000 = $50
  delivery_fee_cents: number      // e.g. 2000 = $20
  dispute_window_hrs: number      // 6
  b2b_stock_pct: number           // 0.80
  b2c_stock_pct: number           // 0.20
  commission_rate_default: number // 0.10
  listing_window_open_day: string // 'sunday'
  listing_window_close_day: string // 'tuesday'
  listing_window_close_time: string // '23:59'
  market_open_time: string        // '08:00'
  market_close_time: string       // '20:00'
}

// ============================================================
// CART
// ============================================================

export interface CartItem {
  product_id: string
  product: Product
  quantity: number
  is_b2b: boolean
  unit_price_cents: number
  reserved_until?: string
  notes?: string
}

export interface Cart {
  items: CartItem[]
  fulfillment_type: FulfillmentType
  hub_id?: string
  delivery_address?: string
}

// ============================================================
// API RESPONSES
// ============================================================

export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ============================================================
// PRICING HELPERS
// ============================================================

export interface PriceBreakdown {
  wholesale_ex_gst_cents: number
  retail_ex_gst_cents: number  // wholesale + markup
  gst_cents: number            // 0 if gst_free
  retail_inc_gst_cents: number
  delivery_fee_cents: number
}
