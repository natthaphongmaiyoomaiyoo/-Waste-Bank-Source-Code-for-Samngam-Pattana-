import { reactive, shallowRef } from 'vue';

// The site's own feedback layer, replacing Quasar's $q.notify / $q.dialog and
// window.alert. Plain functions over module state, so they work anywhere (setup,
// async handlers, stores); MidNotifyHost, mounted once in App.vue, renders it.

export type MidNotifyType = 'success' | 'error' | 'warning' | 'info';

export interface MidNotifyOptions {
  type?: MidNotifyType | undefined;
  message: string;
  // Small heading above the message; defaults to the type's label.
  title?: string | undefined;
  // Milliseconds until it closes by itself (paused while hovered).
  timeout?: number | undefined;
}

export interface MidToast {
  id: number;
  type: MidNotifyType;
  title: string;
  message: string;
  timeout: number;
}

export const midNotifyTitles: Record<MidNotifyType, string> = {
  success: 'สำเร็จ',
  error: 'ไม่สำเร็จ',
  warning: 'แจ้งเตือน',
  info: 'แจ้งให้ทราบ',
};

// Errors and warnings tend to be longer and need acting on, so they stay longer.
const DEFAULT_TIMEOUT: Record<MidNotifyType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const MAX_TOASTS = 4;

let nextId = 1;

export const midToasts = reactive<MidToast[]>([]);

export function midNotify(options: MidNotifyOptions | string): void {
  const opts = typeof options === 'string' ? { message: options } : options;
  const type = opts.type ?? 'info';
  const title = opts.title ?? midNotifyTitles[type];

  // A double-clicked button shouldn't stack two identical toasts: the repeat
  // replaces the earlier one, which also restarts its countdown.
  const duplicate = midToasts.findIndex(
    (toast) => toast.type === type && toast.title === title && toast.message === opts.message,
  );
  if (duplicate !== -1) midToasts.splice(duplicate, 1);

  midToasts.unshift({
    id: nextId++,
    type,
    title,
    message: opts.message,
    timeout: opts.timeout ?? DEFAULT_TIMEOUT[type],
  });
  if (midToasts.length > MAX_TOASTS) midToasts.splice(MAX_TOASTS);
}

export function dismissMidToast(id: number): void {
  const index = midToasts.findIndex((toast) => toast.id === id);
  if (index !== -1) midToasts.splice(index, 1);
}

export interface MidConfirmOptions {
  title: string;
  message?: string | undefined;
  // Same colour tones as MidDialog; destructive actions use 'danger'.
  tone?: 'default' | 'info' | 'warning' | 'danger' | undefined;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  confirmIcon?: string | undefined;
  // The record the action is about, set apart under the message so it is clear
  // who or what is affected: its name, then smaller detail lines (empty ones
  // are skipped).
  item?: { name: string; details?: (string | null | undefined)[] | undefined } | undefined;
  // One small muted line at the bottom: what happens afterwards, kept out of
  // the question so the question stays short.
  note?: string | undefined;
}

export interface MidPromptOptions extends MidConfirmOptions {
  // Label of the free-text field shown under the message.
  inputLabel: string;
}

export interface MidConfirmRequest extends MidConfirmOptions {
  inputLabel?: string | undefined;
  // null = dismissed; true = confirmed; a string = confirmed with prompt text.
  resolve: (result: true | string | null) => void;
}

export const midConfirmRequest = shallowRef<MidConfirmRequest | null>(null);

function openConfirm(options: MidConfirmOptions & { inputLabel?: string | undefined }) {
  // Only one at a time; a newer request dismisses the one still showing.
  midConfirmRequest.value?.resolve(null);
  return new Promise<true | string | null>((resolve) => {
    midConfirmRequest.value = { ...options, resolve };
  });
}

// Resolves true when the confirm button is pressed, false however else it closes.
export async function midConfirm(options: MidConfirmOptions): Promise<boolean> {
  return (await openConfirm(options)) !== null;
}

// Resolves the typed text (possibly '') when confirmed, null when dismissed.
export async function midPrompt(options: MidPromptOptions): Promise<string | null> {
  const result = await openConfirm(options);
  return result === null ? null : result === true ? '' : result;
}
