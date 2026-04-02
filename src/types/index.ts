export interface User {
  id: string; // UUID
  user_name: string;
  role: 'admin' | 'general';
}

export interface Item {
  id: number;
  item_name: string;
  location_name: string;
  location_no: string;
  stock_quantity: number;
}

export interface Request {
  id: number;
  item_id: number;
  user_id: string; // User.id と紐づく
  request_quantity: number;
  status: 'pending' | 'approved' | 'rejected';
}
