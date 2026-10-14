import { API_BASE_URL } from './client';

// Land record queue and cache (docs/design/land-records-acquisition.md). Plain fetch for now;
// these endpoints aren't in openapi.yaml yet.

export type RecordRequest = {
  id: string;
  district: string;
  taluka: string;
  village: string;
  survey_number: string;
  status: 'queued' | 'fetched' | 'not_found' | 'skipped';
  note?: string;
  district_mr: string;
  taluka_mr: string;
  village_mr: string;
  land_parcel_id?: string;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const records = {
  list: (status: string, district = '', taluka = '') =>
    call<{ items: RecordRequest[]; counts: Record<string, number> }>(
      `/record-requests?status=${status}&district=${encodeURIComponent(district)}&taluka=${encodeURIComponent(taluka)}`,
    ),
  enqueue: (items: { district: string; taluka: string; village: string; survey_number: string }[]) =>
    call<{ added: number }>('/record-requests', { method: 'POST', body: JSON.stringify({ items }) }),
  saveResult: (id: string, text: string, sourceUrl: string, image?: { base64: string; mime: string }) =>
    call<{ survey_number: string; owners: number }>(`/record-requests/${id}/result`, {
      method: 'POST',
      body: JSON.stringify({ text, source_url: sourceUrl, image_base64: image?.base64, mime_type: image?.mime }),
    }),
  setStatus: (id: string, status: string, note = '') =>
    call<void>(`/record-requests/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),
  localNames: (district: string, taluka: string, village: string) =>
    call<{ district: string; taluka: string; village: string }>(
      `/reference/geography/local-names?district=${encodeURIComponent(district)}&taluka=${encodeURIComponent(taluka)}&village=${encodeURIComponent(village)}`,
    ),
};

// The mobile number Bhulekh asks for, kept for this session so it's typed once.
let sessionMobile = '';
export const mobileForBhulekh = {
  get: () => sessionMobile,
  set: (m: string) => {
    sessionMobile = m.replace(/\D/g, '').slice(0, 10);
  },
};
