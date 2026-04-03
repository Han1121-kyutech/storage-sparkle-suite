export interface User {
  id: string;
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
  memo?: string; // 備考・用途カラムを追加
}

export interface Request {
  id: number;
  item_id: number;
  user_id: string;
  request_quantity: number;
  status: "pending" | "approved" | "rejected" | "returned"; // 'returned' を含めた最新の状態に統一
  memo?: string; // 申請時のメモ
  created_at?: string; // 作成日時
}
