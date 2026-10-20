// Name-prefix choices for member and guarantor forms. "ไม่ระบุ" is an empty
// string, not text: create forms then omit the prefix, edit forms clear it, and
// every `${prefix ?? ''}${firstName}` join stays free of the word "ไม่ระบุ".
// Use with q-select `emit-value map-options`.
export const namePrefixOptions = [
  { label: 'ไม่ระบุ', value: '' },
  { label: 'นาย', value: 'นาย' },
  { label: 'นาง', value: 'นาง' },
  { label: 'นางสาว', value: 'นางสาว' },
];
