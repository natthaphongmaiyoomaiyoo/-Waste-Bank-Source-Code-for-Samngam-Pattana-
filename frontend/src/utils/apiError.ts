import axios from 'axios';

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<{ error?: string }>(error) && error.response?.data?.error) {
    return error.response.data.error;
  }
  return fallback;
}
