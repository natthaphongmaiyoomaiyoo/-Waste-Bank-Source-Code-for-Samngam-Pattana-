export function sellRequestStatusMeta(status: string) {
  switch (status) {
    case 'confirmed':
      return { label: 'กำลังไปรับ', icon: 'local_shipping', cls: 'chip-going' };
    case 'completed':
      return { label: 'รับซื้อแล้ว', icon: 'task_alt', cls: 'chip-done' };
    case 'cancelled':
      return { label: 'ยกเลิก', icon: 'cancel', cls: 'chip-off' };
    default:
      return { label: 'รอรับเรื่อง', icon: 'hourglass_top', cls: 'chip-wait' };
  }
}
