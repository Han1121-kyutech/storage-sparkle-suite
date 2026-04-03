export interface User {
  id: string | number; // 過去のstring型と現在のnumber型の両方の互換性を担保
  user_name: string;
  role: 0 | 1 | 2; // あなたが残したかった厳密な権限制約
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
  label_no?: string; // 新規追加
  specifications?: string; // 新規追加
  created_at?: string;
}

export interface Request {
  id: number;
  item_id: number;
  user_id: string | number; // Userのid型に合わせる
  request_type?: "checkout" | "consume" | "dispose"; // 新規追加（貸出・消費・廃棄）
  request_quantity: number;
  status: "pending" | "approved" | "rejected" | "returned"; // 厳密な状態管理
  memo?: string;
  created_at?: string;
}
