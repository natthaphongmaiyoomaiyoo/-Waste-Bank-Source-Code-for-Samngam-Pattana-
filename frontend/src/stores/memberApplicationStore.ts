import { defineStore } from 'pinia';
import { api } from 'src/boot/axios';

export type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';

export interface ApplicationDocument {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface MemberApplication {
  id: string;
  referenceNo: string;
  fullName: string;
  idCard: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  village: string;
  occupation: string;
  documents: ApplicationDocument[];
  status: ApplicationStatus;
  note: string;
  submittedAt: string;
  updatedAt: string;
}

interface ApplicationPayload {
  fullName: string;
  idCard: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  village: string;
  occupation: string;
  documents: ApplicationDocument[];
}

const STORAGE_KEY = 'memberApplications';

function loadApplications(): MemberApplication[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as MemberApplication[]) : [];
  } catch {
    return [];
  }
}

function saveApplications(applications: MemberApplication[]) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
}

function makeReferenceNo() {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `WB-${datePart}-${randomPart}`;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? fullName.trim(), lastName: '-' };
  }
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

function normalizeCitizenId(idCard: string) {
  return idCard.replace(/\D/g, '');
}

function buildAddress(payload: ApplicationPayload) {
  return {
    houseNo: payload.address.trim() || undefined,
    moo: payload.village.trim() || undefined,
    subdistrict: undefined,
    district: undefined,
    province: undefined,
    postcode: undefined,
  };
}

export const useMemberApplicationStore = defineStore('memberApplication', {
  state: () => ({
    applications: loadApplications(),
  }),

  getters: {
    latestApplications: (state) =>
      (Array.isArray(state.applications) ? [...state.applications] : []).sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      ),
  },

  actions: {
    async submitApplication(payload: ApplicationPayload) {
      const now = new Date().toISOString();
      const { firstName, lastName } = splitFullName(payload.fullName);
      const citizenId = normalizeCitizenId(payload.idCard);

      const { data: registered } = await api.post<{ member: { id: number; memberCode: string } }>(
        '/auth/register',
        {
          citizenId,
          firstName,
          lastName,
          birthDate: payload.birthDate,
          phone: payload.phone,
          occupation: payload.occupation || undefined,
          address: buildAddress(payload),
        },
      );

      const application: MemberApplication = {
        id: String(registered.member.id),
        referenceNo: registered.member.memberCode || makeReferenceNo(),
        ...payload,
        idCard: citizenId,
        status: 'pending',
        note: 'ระบบได้รับใบสมัครแล้ว กรุณารอเจ้าหน้าที่ตรวจสอบเอกสาร',
        submittedAt: now,
        updatedAt: now,
      };

      this.applications.unshift(application);
      saveApplications(this.applications);
      return application;
    },

    findApplication(keyword: string) {
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) return null;

      return (
        this.applications.find(
          (application) =>
            application.referenceNo.toLowerCase() === normalized ||
            application.idCard.replaceAll('-', '') === normalized.replaceAll('-', ''),
        ) || null
      );
    },

    updateStatus(id: string, status: ApplicationStatus, note: string) {
      const application = this.applications.find((item) => item.id === id);
      if (!application) return;

      application.status = status;
      application.note = note;
      application.updatedAt = new Date().toISOString();
      saveApplications(this.applications);
    },
  },
});
