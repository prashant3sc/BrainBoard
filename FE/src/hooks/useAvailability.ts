export type AvailabilityStatus = 'working' | 'on_leave';

/**
 * FE-only mock. Returns deterministic availability based on userId hash
 * so both states are visible without a backend. Replace getStatus with
 * an API-backed store when the backend is ready.
 */
export function useAvailability() {
  function getStatus(userId: string): AvailabilityStatus {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return h % 3 === 2 ? 'on_leave' : 'working';
  }

  return { getStatus };
}
