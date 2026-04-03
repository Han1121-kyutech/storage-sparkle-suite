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
  scheduled_date?: string; // 予約機能のために追加
  created_at?: string;
}
