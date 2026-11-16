import { ActiveUser } from '../context/AuthContext';

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {},
  user?: ActiveUser | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (user) {
    headers['x-user-role'] = user.role;
    headers['x-user-id'] = user.profileId;
    if (user.studentId) headers['x-student-id'] = user.studentId;
    if (user.teacherId) headers['x-teacher-id'] = user.teacherId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    try {
      const errData = await res.json();
      errMsg = errData.error_ur || errData.error || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return res.json();
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
