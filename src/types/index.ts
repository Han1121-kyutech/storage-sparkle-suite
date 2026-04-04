// src/types/index.ts
export interface User {
  id: string | number;
  user_name: string;
  role: 0 | 1 | 2;
  password?: string;
  is_active?: boolean;
}

export interface Item {
  id: number;
  item_name: string;
  location_name: string;
  location_no: string;
  stock_quantity: number;
  alert_threshold: number; // 追加: 閾値の個別設定用
  category?: string; // 追加: 権力者（Role 2）によるカテゴリ支配用
  memo?: string;
  label_no?: string;
  specifications?: string;
  created_at?: string;
}

export interface Request {
  id: number;
  item_id: number;
  user_id: string | number;
  request_type: "checkout" | "consume" | "dispose";
  request_quantity: number;
  status: "pending" | "approved" | "rejected" | "returned";
  memo?: string;
  scheduled_date?: string;
  created_at?: string;
}
