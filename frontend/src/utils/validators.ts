export const required = (v: string | null) => (v && v.trim().length > 0) || 'จำเป็นต้องกรอก';
