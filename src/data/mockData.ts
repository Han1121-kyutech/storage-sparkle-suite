import { User, Item, Request } from '@/types';

export const mockUsers: User[] = [
  { id: 'u-001', user_name: '田中 太郎', role: 'admin' },
  { id: 'u-002', user_name: '佐藤 花子', role: 'general' },
  { id: 'u-003', user_name: '鈴木 一郎', role: 'general' },
];

export const mockItems: Item[] = [
  { id: 1, item_name: 'ボールペン（黒）', location_name: 'A棚', location_no: 'A-01', stock_quantity: 120 },
  { id: 2, item_name: 'コピー用紙 A4', location_name: 'B棚', location_no: 'B-03', stock_quantity: 45 },
  { id: 3, item_name: 'ファイルボックス', location_name: 'C棚', location_no: 'C-02', stock_quantity: 8 },
  { id: 4, item_name: 'マスキングテープ', location_name: 'A棚', location_no: 'A-05', stock_quantity: 200 },
  { id: 5, item_name: '段ボール箱（中）', location_name: 'D棚', location_no: 'D-01', stock_quantity: 15 },
  { id: 6, item_name: 'プリンターインク', location_name: 'B棚', location_no: 'B-07', stock_quantity: 3 },
  { id: 7, item_name: 'ハサミ', location_name: 'A棚', location_no: 'A-02', stock_quantity: 30 },
  { id: 8, item_name: '結束バンド', location_name: 'C棚', location_no: 'C-10', stock_quantity: 500 },
];

export const mockRequests: Request[] = [
  { id: 1, item_id: 1, user_id: 'u-002', request_quantity: 10, status: 'pending' },
  { id: 2, item_id: 3, user_id: 'u-003', request_quantity: 2, status: 'approved' },
  { id: 3, item_id: 6, user_id: 'u-002', request_quantity: 1, status: 'pending' },
  { id: 4, item_id: 2, user_id: 'u-003', request_quantity: 5, status: 'rejected' },
  { id: 5, item_id: 5, user_id: 'u-002', request_quantity: 3, status: 'approved' },
];
