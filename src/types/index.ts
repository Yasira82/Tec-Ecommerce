// ── Product ───────────────────────────────────────────────
export interface Product {
  id:            string;
  title:         string;
  description:   string;
  price:         number;
  currency:      string;
  images:        string[];
  category:      string;
  category_slug: string;
  merchant_id:   string;
  merchant_name: string;
  status:        'active' | 'sold' | 'inactive';
  rating:        number;
  reviews_count: number;
  stock:         number;
  created_at:    string;
  metadata?:     Record<string, unknown>;
}

// ── Category ──────────────────────────────────────────────
export interface Category {
  id:    string;
  name:  string;
  slug:  string;
  emoji: string;
  count: number;
}

// ── Order ─────────────────────────────────────────────────
export interface Order {
  id:          string;
  product_id:  string;
  product:     Pick<Product, 'title' | 'images' | 'price' | 'currency'>;
  buyer_id:    string;
  seller_id:   string;
  amount:      number;
  currency:    string;
  status:      'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_id:  string;
  txid?:       string;
  created_at:  string;
}

// ── Merchant ──────────────────────────────────────────────
export interface Merchant {
  id:             string;
  username:       string;
  display_name:   string;
  avatar?:        string;
  rating:         number;
  products_count: number;
  sales_count:    number;
  joined_at:      string;
}

// ── Filters ───────────────────────────────────────────────
export type SortOption = 'newest' | 'price_asc' | 'price_desc' | 'rating';

export interface ProductFilters {
  search?:   string;
  category?: string;
  sort?:     SortOption;
  page?:     number;
  limit?:    number;
}
