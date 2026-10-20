<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <!-- Hero -->
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>
        <div class="hero-row">
          <div class="hero-icon"><q-icon name="people" /></div>
          <div class="hero-copy">
            <h1>รายชื่อสมาชิก</h1>
          </div>
          <q-btn
            unelevated no-caps icon="person_add"
            label="ลงทะเบียนสมาชิกใหม่"
            class="hero-add-btn"
            @click="openAddDialog"
          />
        </div>
      </section>

      <!-- Table panel -->
      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <div class="panel-head">
          <div>
            <div class="panel-title">ทะเบียนสมาชิกทั้งหมด</div>
            <div class="panel-caption">{{ filteredMembers.length }} รายการ</div>
          </div>
          <q-input
            outlined dense clearable
            v-model="searchQuery"
            placeholder="ค้นหาสมาชิก..."
            class="filter-search"
          >
            <template v-slot:append><q-icon name="search" /></template>
          </q-input>
        </div>

        <q-table
          flat
          :rows="pagedMembers"
          :columns="columns"
          row-key="id"
          :pagination="{ rowsPerPage: 8 }"
          hide-pagination
          class="muni-table"
        >
          <template v-slot:body-cell-balance="props">
            <q-td :props="props">
              <span :class="props.row.balance > 50 ? 'text-positive text-weight-bold' : 'text-red-7 text-weight-bold'">
                {{ props.row.balance.toFixed(2) }}
              </span>
            </q-td>
          </template>

          <template v-slot:body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="props.row.status === 'active' ? 'green-2' : 'grey-3'"
                :text-color="props.row.status === 'active' ? 'positive' : 'grey-7'"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ props.row.status === 'active' ? 'ใช้งาน' : 'เสียชีวิต' }}
              </q-badge>
            </q-td>
          </template>

          <template v-slot:body-cell-actions="props">
            <q-td :props="props">
              <div class="action-btns">
                <q-btn flat dense round icon="edit" color="positive" size="sm" @click="openEditDialog(props.row)">
                  <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                </q-btn>
                <q-btn flat dense round icon="delete" color="red-7" size="sm" @click="confirmDelete(props.row)">
                  <q-tooltip>ลบสมาชิก</q-tooltip>
                </q-btn>
                <q-btn flat dense round icon="history" color="primary" size="sm" @click="openHistory(props.row)">
                  <q-tooltip>ดูประวัติธุรกรรม</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state">
              <q-icon name="person_search" size="32px" />
              ไม่พบสมาชิกที่ค้นหา
            </div>
          </template>
        </q-table>

        <div class="table-footer">
          <div class="text-caption text-grey-6">แสดง {{ filteredMembers.length }} รายการ</div>
          <q-pagination
            v-model="currentPage"
            :max="Math.ceil(filteredMembers.length / rowsPerPage)"
            direction-links
            active-color="positive"
            color="grey-4"
            text-color="black"
          />
        </div>
      </q-card>
    </div>

    <!-- Add/Edit Dialog -->
    <q-dialog v-model="showRegisterDialog" persistent>
      <q-card class="admin-dialog dialog-md">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon">
              <q-icon :name="isEditMode ? 'edit' : 'person_add'" />
            </div>
            {{ isEditMode ? 'แก้ไขข้อมูลสมาชิก' : 'ลงทะเบียนสมาชิกใหม่' }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="row q-col-gutter-md">
            <div class="col-12 col-md-4 text-center">
              <q-avatar size="90px" color="green-2" text-color="positive" icon="person" class="q-mb-sm" />
              <div class="text-positive cursor-pointer text-weight-medium text-caption">อัพโหลดรูปโปรไฟล์</div>
            </div>
            <div class="col-12 col-md-8 row q-col-gutter-sm">
              <div class="col-12">
                <div class="dialog-section-label">เลขบัตรประชาชน (13 หลัก)</div>
                <q-input outlined dense v-model="memberForm.idCard" placeholder="x-xxxx-xxxxx-xx-x" maxlength="13" type="tel" @keypress="onlyNumber" />
              </div>
              <div class="col-12">
                <div class="dialog-section-label">ชื่อ - นามสกุล</div>
                <q-input outlined dense v-model="memberForm.name" placeholder="กรอกชื่อ-นามสกุล" @keypress="onlyAlphabet" />
              </div>
              <div class="col-12 col-md-6">
                <div class="dialog-section-label">วัน/เดือน/ปีเกิด</div>
                <MidDateField v-model="memberForm.birthDate" no-future />
              </div>
              <div class="col-12 col-md-6">
                <div class="dialog-section-label">เบอร์โทรศัพท์</div>
                <q-input outlined dense v-model="memberForm.phone" placeholder="0xx-xxx-xxxx" @keypress="onlyNumber" />
              </div>
            </div>

            <div class="col-12 col-md-6">
              <div class="dialog-section-label">ที่อยู่ตามทะเบียนบ้าน</div>
              <q-input outlined dense v-model="memberForm.address" type="textarea" rows="3" />
            </div>
            <div class="col-12 col-md-6">
              <div class="dialog-section-label">สังกัดหมู่บ้าน/กองทุน</div>
              <q-select outlined dense v-model="memberForm.village" :options="villageOptions" emit-value map-options />
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <q-btn outline label="ยกเลิก" color="grey-7" v-close-popup />
          <q-btn unelevated label="บันทึกข้อมูล" color="positive" icon="save" @click="saveMember" />
        </div>
      </q-card>
    </q-dialog>

    <!-- History Dialog -->
    <q-dialog v-model="showHistoryDialog">
      <q-card class="admin-dialog dialog-lg">
        <div class="dialog-head">
          <div class="dialog-title">
            <div class="dialog-title-icon"><q-icon name="history" /></div>
            ประวัติธุรกรรม: {{ selectedMember?.name }}
          </div>
          <q-btn icon="close" flat round dense v-close-popup />
        </div>

        <div class="dialog-body">
          <div class="row q-col-gutter-md items-end q-mb-md">
            <div class="col-12 col-md-3">
              <div class="dialog-section-label">จากวันที่</div>
              <MidDateField v-model="historyFilter.startDate" />
            </div>
            <div class="col-12 col-md-3">
              <div class="dialog-section-label">ถึงวันที่</div>
              <MidDateField v-model="historyFilter.endDate" />
            </div>
            <div class="col-12 col-md-4">
              <div class="dialog-section-label">ประเภทธุรกรรม</div>
              <q-select outlined dense v-model="historyFilter.type" :options="['ทั้งหมด', 'ขายขยะรีไซเคิล', 'ถอนเงิน', 'ฝากเงินสด']" />
            </div>
            <div class="col-12 col-md-2">
              <q-btn color="positive" label="ค้นหา" unelevated class="full-width" style="height: 40px" />
            </div>
          </div>

          <div class="history-summary q-mb-md">
            <div class="history-summary-item">
              <span class="text-positive text-weight-bold">+{{ totalIncome.toFixed(2) }}</span>
              <span class="text-caption text-grey-6 q-ml-xs">รายรับรวม</span>
            </div>
            <div class="history-summary-item">
              <span class="text-red-7 text-weight-bold">-{{ totalExpense.toFixed(2) }}</span>
              <span class="text-caption text-grey-6 q-ml-xs">รายจ่ายรวม</span>
            </div>
          </div>

          <q-table
            flat
            :rows="memberTransactions"
            :columns="historyColumns"
            row-key="id"
            hide-pagination
            :pagination="{ rowsPerPage: 10 }"
            class="muni-table"
          >
            <template v-slot:body-cell-dateTime="props">
              <q-td :props="props">
                <div class="text-weight-bold">{{ props.row.date }}</div>
                <div class="text-caption text-grey-6">{{ props.row.time }}</div>
              </q-td>
            </template>
            <template v-slot:body-cell-details="props">
              <q-td :props="props">
                <div class="text-weight-bold">{{ props.row.type }}</div>
                <div class="text-caption text-grey-6">{{ props.row.detail }}</div>
              </q-td>
            </template>
            <template v-slot:body-cell-amount="props">
              <q-td :props="props" :class="props.row.isIncome ? 'text-positive text-weight-bold' : 'text-red-7 text-weight-bold'">
                {{ props.row.isIncome ? '+' : '-' }} {{ props.row.amount.toFixed(2) }}
              </q-td>
            </template>
            <template v-slot:body-cell-operator="props">
              <q-td :props="props">
                <q-badge color="green-2" text-color="positive" class="q-px-sm q-py-xs" rounded>{{ props.row.operator }}</q-badge>
              </q-td>
            </template>
          </q-table>
        </div>

        <div class="dialog-footer" style="justify-content: space-between;">
          <div class="row q-gutter-sm items-center">
            <span class="text-caption text-grey-7">{{ memberTransactions.length }} รายการ</span>
            <q-btn outline icon="download" label="ส่งออก Excel" color="grey-7" size="sm" />
          </div>
          <q-btn unelevated label="ปิด" color="positive" class="q-px-lg" v-close-popup />
        </div>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useMemberStore } from 'src/stores/memberStore';
import type { QTableProps } from 'quasar';
import { useVillageStore } from 'src/stores/villageStore';
import type { Village } from 'src/stores/models';
import { useTransactionStore } from 'src/stores/transactionStore';
import { MidDateField, midConfirm, midNotify } from 'components/MID';

const memberStore = useMemberStore();
const villageStore = useVillageStore();
const transactionStore = useTransactionStore();

interface MemberRow {
  id: string;
  memberCode: string;
  name: string;
  idCard?: string;
  phone?: string;
  balance: number;
  status: 'active' | 'inactive';
  villageId: string;
}

const searchQuery = ref('');
const currentPage = ref(1);
const rowsPerPage = 8;
const showRegisterDialog = ref(false);
const showHistoryDialog = ref(false);
const isEditMode = ref(false);
const editingMemberId = ref<string | null>(null);
const selectedMember = ref<MemberRow | null>(null);

const memberForm = ref({
  idCard: '',
  name: '',
  birthDate: '',
  phone: '',
  address: '',
  village: '',
});

const historyFilter = ref({ startDate: '', endDate: '', type: 'ทั้งหมด' });

const villageOptions = computed(() =>
  villageStore.villages.map((v: Village) => ({ label: v.name, value: v.id })),
);

const columns: QTableProps['columns'] = [
  { name: 'memberCode', align: 'left', label: 'รหัสสมาชิก', field: 'memberCode', sortable: true },
  { name: 'name', align: 'left', label: 'ชื่อ-นามสกุล', field: 'name', sortable: true },
  { name: 'idCard', align: 'left', label: 'เลขบัตรประชาชน', field: 'idCard' },
  { name: 'phone', align: 'left', label: 'เบอร์โทรศัพท์', field: 'phone' },
  { name: 'balance', align: 'center', label: 'ยอดเงินปัจจุบัน', field: 'balance', sortable: true },
  { name: 'status', align: 'center', label: 'สถานะ', field: 'status' },
  { name: 'actions', align: 'center', label: 'การดำเนินการ', field: 'actions' },
];

const historyColumns: QTableProps['columns'] = [
  { name: 'dateTime', align: 'left', label: 'วันที่/เวลา', field: 'date' },
  { name: 'details', align: 'left', label: 'ประเภทธุรกรรม', field: 'type' },
  { name: 'amount', align: 'right', label: 'จำนวนเงิน', field: 'amount' },
  { name: 'balance', align: 'right', label: 'ยอดคงเหลือ', field: 'balance' },
  { name: 'operator', align: 'center', label: 'ผู้ดำเนินการ', field: 'operator' },
];

const filteredMembers = computed(() => {
  const all = memberStore.allMembers as MemberRow[];
  if (!searchQuery.value) return all;
  const query = searchQuery.value.toLowerCase();
  return all.filter(
    (m) =>
      m.name.toLowerCase().includes(query) ||
      m.memberCode.includes(query) ||
      (m.idCard && m.idCard.includes(query)),
  );
});

const pagedMembers = computed(() => {
  const sorted = [...filteredMembers.value].sort(
    (a, b) => Number(b.memberCode) - Number(a.memberCode),
  );
  const start = (currentPage.value - 1) * rowsPerPage;
  return sorted.slice(start, start + rowsPerPage);
});

const memberTransactions = computed(() => {
  if (!selectedMember.value) return [];
  return transactionStore.getTransactionsByMember(selectedMember.value.id);
});

const totalIncome = computed(() =>
  memberTransactions.value.filter((t) => t.isIncome).reduce((sum, t) => sum + t.amount, 0),
);
const totalExpense = computed(() =>
  memberTransactions.value.filter((t) => !t.isIncome).reduce((sum, t) => sum + t.amount, 0),
);

const onlyNumber = (e: KeyboardEvent) => {
  if (!/[0-9]/.test(e.key)) e.preventDefault();
};

const onlyAlphabet = (e: KeyboardEvent) => {
  if (!/^[A-Za-zก-ฮะ-์\s]$/.test(e.key)) e.preventDefault();
};

const openAddDialog = () => {
  isEditMode.value = false;
  editingMemberId.value = null;
  const firstVillage = villageOptions.value?.[0];
  memberForm.value = { idCard: '', name: '', birthDate: '', phone: '', address: '', village: firstVillage ? firstVillage.value : '' };
  showRegisterDialog.value = true;
};

const openEditDialog = (member: MemberRow) => {
  isEditMode.value = true;
  editingMemberId.value = member.id;
  memberForm.value = {
    idCard: member.idCard || '',
    name: member.name,
    birthDate: '',
    phone: member.phone || '',
    address: '',
    village: member.villageId ? member.villageId.replace('v', '') : '',
  };
  showRegisterDialog.value = true;
};

const saveMember = () => {
  if (isEditMode.value && editingMemberId.value) {
    memberStore.updateMember(editingMemberId.value, memberForm.value);
    midNotify({ type: 'success', message: 'แก้ไขข้อมูลสำเร็จ' });
  } else {
    memberStore.addMember(memberForm.value);
    midNotify({ type: 'success', message: 'ลงทะเบียนสมาชิกสำเร็จ' });
  }
  showRegisterDialog.value = false;
};

const confirmDelete = async (member: MemberRow) => {
  const confirmed = await midConfirm({
    title: 'ยืนยันการลบ',
    message: `คุณต้องการลบข้อมูลของ ${member.name} (รหัส ${member.memberCode}) ใช่หรือไม่?`,
    tone: 'danger',
    confirmLabel: 'ลบข้อมูล',
  });
  if (!confirmed) return;
  memberStore.deleteMember(member.id);
  midNotify({ type: 'success', message: 'ลบข้อมูลสมาชิกแล้ว' });
};

const openHistory = (member: MemberRow) => {
  selectedMember.value = member;
  showHistoryDialog.value = true;
};

onMounted(() => {
  const first = villageOptions.value?.[0];
  if (first) memberForm.value.village = first.label;
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;

.filter-search {
  width: 260px;
}

.table-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-top: 1px solid #eaf1eb;
}

.history-summary {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #f5faf6;
  border-radius: 12px;
  border: 1px solid #ddeee2;
}

.history-summary-item {
  display: flex;
  align-items: baseline;
}
</style>
