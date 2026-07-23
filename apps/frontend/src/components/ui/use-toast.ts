import { useEffect, useState } from 'react';

const TOAST_LIMIT = 3;
const TOAST_DURATION_MS = 5000;

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

type Listener = (toasts: ToastItem[]) => void;

let memoryState: ToastItem[] = [];
const listeners: Listener[] = [];
let idCounter = 0;

function emit(): void {
  listeners.forEach((listener) => listener(memoryState));
}

export function dismiss(id: string): void {
  memoryState = memoryState.filter((item) => item.id !== id);
  emit();
}

export function toast(item: Omit<ToastItem, 'id'>): string {
  const id = `toast-${++idCounter}`;
  memoryState = [...memoryState, { ...item, id }].slice(-TOAST_LIMIT);
  emit();
  setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  return id;
}

export function useToast(): { toasts: ToastItem[]; dismiss: (id: string) => void } {
  const [toasts, setToasts] = useState<ToastItem[]>(memoryState);

  useEffect(() => {
    listeners.push(setToasts);
    return () => {
      const index = listeners.indexOf(setToasts);
      if (index > -1) listeners.splice(index, 1);
    };
  }, []);

  return { toasts, dismiss };
}
