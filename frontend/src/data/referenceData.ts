import type { Village, WasteTypes } from 'src/stores/models';

export const DEFAULT_VILLAGES: Village[] = [
  { id: '1', name: 'หมู่บ้านที่ 1', memberCount: 120, fundBalance: 45400 },
  { id: '2', name: 'หมู่บ้านที่ 2', memberCount: 179, fundBalance: 59000 },
  { id: '3', name: 'หมู่บ้านที่ 3', memberCount: 75, fundBalance: 17010 },
  { id: '4', name: 'หมู่บ้านที่ 4', memberCount: 205, fundBalance: 45000 },
];

export const DEFAULT_WASTE_TYPES: WasteTypes[] = [
  { id: 1, name: 'ขวดพลาสติกใส (PET)', price: 8.0 },
  { id: 2, name: 'ขวดพลาสติกขุ่น (HDPE)', price: 10.0 },
  { id: 3, name: 'แก้วสี', price: 2.0 },
  { id: 4, name: 'แก้วใส', price: 3.0 },
  { id: 5, name: 'กระดาษขาวดำ', price: 4.5 },
  { id: 6, name: 'กระดาษลัง', price: 3.5 },
  { id: 7, name: 'กระป๋องอลูมิเนียม', price: 35.0 },
  { id: 8, name: 'เศษเหล็ก', price: 8.5 },
];
