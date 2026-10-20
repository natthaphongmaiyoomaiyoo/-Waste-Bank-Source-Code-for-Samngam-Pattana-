<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon">
            <q-icon name="group" />
          </div>
          <div class="hero-copy">
            <h1>จัดการสมาชิก</h1>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="person_add"
            label="เพิ่มสมาชิกใหม่"
            class="hero-add-btn"
            to="/admin/add-member"
          />
        </div>
      </section>

      <q-banner v-if="summary.error" rounded class="bg-red-1 text-red-9 error-banner">
        {{ summary.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadSummary" />
        </template>
      </q-banner>

      <section v-else class="summary-grid">
        <article v-for="card in summaryCards" :key="card.label" class="summary-card">
          <div :class="['summary-icon', card.iconClass]">
            <q-icon :name="card.icon" />
          </div>
          <div class="summary-content">
            <div class="summary-label">{{ card.label }}</div>
            <div class="summary-value">
              <q-skeleton v-if="summary.loading && !summary.data" type="text" width="70px" />
              <template v-else>
                {{ card.value }}
                <span>คน</span>
              </template>
            </div>
          </div>
        </article>
      </section>

      <q-card flat class="panel-card panel-card--flush q-mt-lg">
        <AdminPanelHeader title="ทะเบียนสมาชิก">
          <template #filters>
            <div class="filter-row">
              <MidFilterBar
                v-model:search="search"
                search-label="ค้นหา (ชื่อ / เลขบัตร / เบอร์โทร / รหัสสมาชิก)"
                title="กรองรายชื่อสมาชิก"
                :active="activeFilters"
                @update:search="applyFilters"
                @clear="clearFilter"
                @clear-all="clearAllFilters"
              >
                <q-select
                  v-model="status"
                  dense
                  outlined
                  clearable
                  emit-value
                  map-options
                  label="สถานะ"
                  :options="statusOptions"
                  @update:model-value="applyFilters"
                />
                <template #actions>
                  <q-select
                    v-model="selectedVillageAreaId"
                    dense
                    outlined
                    clearable
                    emit-value
                    map-options
                    class="village-select"
                    label="เลือกหมู่บ้าน"
                    :options="villageOptions"
                    @update:model-value="applyFilters"
                  />
                </template>
              </MidFilterBar>
            </div>
          </template>
        </AdminPanelHeader>

        <q-banner v-if="members.error" rounded class="bg-red-1 text-red-9 q-ma-md">
          {{ members.error }}
          <template #action>
            <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadMembers" />
          </template>
        </q-banner>

        <q-table
          v-else
          flat
          row-key="id"
          class="muni-table member-table"
          :grid="$q.screen.lt.sm"
          :rows="members.data?.items ?? []"
          :columns="columns"
          :loading="members.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
          @row-click="(_evt, row) => openDetail(row as CommitteeMember)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <template #item="props">
            <AdminGridCard
              clickable
              :title="memberFullName(props.row as CommitteeMember)"
              :subtitle="`รหัส ${props.row.memberCode} · ${props.row.phone || '-'}`"
              :rows="[
                { label: 'เลขบัตรประชาชน', value: props.row.citizenId },
                { label: 'ที่อยู่', value: memberAddressLabel(props.row as CommitteeMember) },
                { label: 'วันที่สมัคร', value: formatThaiDate(props.row.applyDate) },
              ]"
              @click="openDetail(props.row as CommitteeMember)"
            >
              <template #avatar>
                <q-avatar size="46px" class="row-avatar card-avatar">
                  <img
                    v-if="props.row.avatarUrl && !brokenAvatars.has(props.row.id)"
                    :src="props.row.avatarUrl"
                    :alt="memberFullName(props.row as CommitteeMember)"
                    @error="markAvatarBroken(props.row.id)"
                  />
                  <!-- No photo uploaded: the first letter of the given name. -->
                  <span v-else>{{ props.row.firstName.charAt(0) }}</span>
                </q-avatar>
              </template>
              <template #chips>
                <q-badge
                  :color="memberStatusColor(props.row.status).color"
                  :text-color="memberStatusColor(props.row.status).textColor"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  {{ memberStatusLabel(props.row.status) }}
                </q-badge>
                <q-badge
                  v-if="props.row.funeralCases?.length"
                  color="orange-1"
                  text-color="orange-10"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  รอเทศบาลอนุมัติการเสียชีวิต
                </q-badge>
              </template>
              <template #rows>
                <div v-if="props.row.benefitEligibility">
                  <dt>สิทธิ์ขอรับเงินกองทุน</dt>
                  <dd>
                    <q-badge
                      :color="props.row.benefitEligibility.eligible ? 'green-2' : 'amber-2'"
                      :text-color="props.row.benefitEligibility.eligible ? 'positive' : 'orange-10'"
                      class="q-px-sm q-py-xs"
                      rounded
                    >
                      {{ props.row.benefitEligibility.eligible ? 'ครบเงื่อนไข' : 'ยังไม่ครบ' }}
                    </q-badge>
                  </dd>
                </div>
                <div v-if="props.row.status === 'pending'">
                  <dt>ผลตรวจคุณสมบัติ</dt>
                  <dd>
                    <q-badge
                      :color="verificationMeta(props.row as CommitteeMember).color"
                      :text-color="verificationMeta(props.row as CommitteeMember).textColor"
                      class="q-px-sm q-py-xs"
                      rounded
                    >
                      {{ verificationMeta(props.row as CommitteeMember).label }}
                    </q-badge>
                  </dd>
                </div>
              </template>
              <template #actions>
                <q-btn
                  unelevated
                  no-caps
                  size="sm"
                  icon="visibility"
                  label="รายละเอียด"
                  class="is-detail"
                  @click="openDetail(props.row as CommitteeMember)"
                />
                <q-btn
                  v-if="canManageMember(props.row)"
                  unelevated
                  no-caps
                  size="sm"
                  icon="edit"
                  label="แก้ไข"
                  class="is-edit"
                  @click="openEdit(props.row as CommitteeMember)"
                />
                <q-btn
                  v-if="props.row.status === 'pending'"
                  unelevated
                  no-caps
                  size="sm"
                  icon="how_to_reg"
                  label="อนุมัติ"
                  class="is-approve"
                  :disable="latestVerification(props.row)?.result !== 'passed'"
                  @click="openAction('approve', props.row as CommitteeMember)"
                />
                <q-btn
                  v-if="canManageMember(props.row)"
                  unelevated
                  no-caps
                  size="sm"
                  icon="person_off"
                  label="ยกเลิกสมาชิก"
                  class="is-cancel"
                  @click="openAction('cancel', props.row as CommitteeMember)"
                />
                <q-btn
                  v-if="canManageMember(props.row)"
                  unelevated
                  no-caps
                  size="sm"
                  icon="volunteer_activism"
                  label="แจ้งเสียชีวิต"
                  class="is-deceased"
                  :to="`/admin/members/${props.row.id}/deceased`"
                />
              </template>
            </AdminGridCard>
          </template>

          <!-- Name cell carries the profile photo, same as the committee's list. -->
          <template #body-cell-name="props">
            <q-td :props="props">
              <div class="name-cell">
                <q-avatar size="38px" class="row-avatar">
                  <img
                    v-if="props.row.avatarUrl && !brokenAvatars.has(props.row.id)"
                    :src="props.row.avatarUrl"
                    :alt="memberFullName(props.row as CommitteeMember)"
                    @error="markAvatarBroken(props.row.id)"
                  />
                  <span v-else>{{ props.row.firstName.charAt(0) }}</span>
                </q-avatar>
                <span class="name-text">{{ memberFullName(props.row as CommitteeMember) }}</span>
              </div>
            </q-td>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <q-badge
                :color="memberStatusColor(props.row.status).color"
                :text-color="memberStatusColor(props.row.status).textColor"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ memberStatusLabel(props.row.status) }}
              </q-badge>
              <q-badge
                v-if="props.row.funeralCases?.length"
                color="orange-1"
                text-color="orange-10"
                class="q-px-sm q-py-xs"
                rounded
              >
                รอเทศบาลอนุมัติการเสียชีวิต
              </q-badge>
            </q-td>
          </template>

          <!-- Fund-claim (funeral benefit) eligibility - only active members
               can claim, so everyone else shows a dash instead of a badge. -->
          <template #body-cell-benefit="props">
            <q-td :props="props">
              <template v-if="props.row.benefitEligibility">
                <q-badge
                  :color="props.row.benefitEligibility.eligible ? 'green-2' : 'amber-2'"
                  :text-color="props.row.benefitEligibility.eligible ? 'positive' : 'orange-10'"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  <q-icon
                    :name="props.row.benefitEligibility.eligible ? 'verified' : 'hourglass_bottom'"
                    class="q-mr-xs"
                  />
                  {{ props.row.benefitEligibility.eligible ? 'ครบเงื่อนไข' : 'ยังไม่ครบ' }}
                </q-badge>
                <q-tooltip class="benefit-tooltip">
                  <div class="benefit-tooltip-title">เงื่อนไขขอรับเงินจากกองทุน</div>
                  <div
                    v-for="condition in benefitConditions(props.row.benefitEligibility)"
                    :key="condition.label"
                    class="benefit-tooltip-row"
                  >
                    <q-icon :name="condition.passed ? 'check_circle' : 'cancel'" />
                    {{ condition.label }}
                  </div>
                </q-tooltip>
              </template>
              <span v-else>-</span>
            </q-td>
          </template>

          <template #body-cell-verification="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.status === 'pending'"
                :color="
                  latestVerification(props.row)?.result === 'passed'
                    ? 'green-2'
                    : latestVerification(props.row)
                      ? 'red-2'
                      : 'grey-3'
                "
                :text-color="
                  latestVerification(props.row)?.result === 'passed'
                    ? 'positive'
                    : latestVerification(props.row)
                      ? 'red-9'
                      : 'grey-8'
                "
                class="q-px-sm q-py-xs"
                rounded
              >
                {{
                  latestVerification(props.row)
                    ? latestVerification(props.row)?.result === 'passed'
                      ? 'ผ่านการตรวจสอบ'
                      : 'ไม่ผ่านการตรวจสอบ'
                    : 'ยังไม่ตรวจสอบ'
                }}
              </q-badge>
              <span v-else>-</span>
            </q-td>
          </template>

          <template #body-cell-actions="props">
            <q-td :props="props" @click.stop>
              <div class="action-btns">
                <q-btn
                  flat
                  dense
                  round
                  size="sm"
                  icon="visibility"
                  color="positive"
                  @click="openDetail(props.row as CommitteeMember)"
                >
                  <q-tooltip>ดูรายละเอียด / ตรวจสอบคุณสมบัติ</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="canManageMember(props.row)"
                  flat
                  dense
                  round
                  size="sm"
                  icon="edit"
                  color="primary"
                  @click="openEdit(props.row as CommitteeMember)"
                >
                  <q-tooltip>แก้ไขข้อมูล</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="props.row.status === 'pending'"
                  flat
                  dense
                  round
                  size="sm"
                  icon="how_to_reg"
                  color="teal"
                  :disable="latestVerification(props.row)?.result !== 'passed'"
                  @click="openAction('approve', props.row as CommitteeMember)"
                >
                  <q-tooltip>
                    {{
                      latestVerification(props.row)?.result === 'passed'
                        ? 'อนุมัติเป็นสมาชิก'
                        : 'ต้องผ่านการตรวจสอบคุณสมบัติก่อนอนุมัติ (กดดูรายละเอียด)'
                    }}
                  </q-tooltip>
                </q-btn>
                <q-btn
                  v-if="canManageMember(props.row)"
                  flat
                  dense
                  round
                  size="sm"
                  icon="person_off"
                  color="red-7"
                  @click="openAction('cancel', props.row as CommitteeMember)"
                >
                  <q-tooltip>ยกเลิกสมาชิกภาพ</q-tooltip>
                </q-btn>
                <q-btn
                  v-if="canManageMember(props.row)"
                  flat
                  dense
                  round
                  size="sm"
                  icon="volunteer_activism"
                  color="deep-purple-7"
                  :to="`/admin/members/${props.row.id}/deceased`"
                >
                  <q-tooltip>แจ้งเสียชีวิตและหักเงินสะสม 50 บาทจากสมาชิกใช้งานทุกคน</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state" v-if="!members.loading">
              <q-icon name="person_search" size="32px" />
              ไม่พบข้อมูลสมาชิกตามเงื่อนไขที่เลือก
            </div>
          </template>
        </q-table>
      </q-card>
    </div>

    <!-- ============ Detail + eligibility verification dialog ============ -->
    <q-dialog v-model="detailOpen" @hide="detailMemberId = null">
      <q-card class="detail-card">
        <div v-if="detail.loading" class="loading-wrap">
          <q-spinner color="positive" size="42px" />
        </div>

        <q-banner v-else-if="detail.error" rounded class="bg-red-1 text-red-9 q-ma-md">
          {{ detail.error }}
        </q-banner>

        <template v-else-if="detail.data">
          <div class="detail-head">
            <div>
              <div class="detail-name">
                {{ memberFullName(detail.data) }}
                <q-badge
                  :color="memberStatusColor(detail.data.status).color"
                  :text-color="memberStatusColor(detail.data.status).textColor"
                  class="q-ml-sm q-px-sm"
                  rounded
                >
                  {{ memberStatusLabel(detail.data.status) }}
                </q-badge>
                <q-badge
                  v-if="detail.data.funeralCases?.length"
                  color="orange-1"
                  text-color="orange-10"
                  class="q-ml-xs q-px-sm"
                  rounded
                >
                  รอเทศบาลอนุมัติการเสียชีวิต
                </q-badge>
              </div>
              <div class="detail-sub">
                รหัสสมาชิก {{ detail.data.memberCode }} - สมัครเมื่อ
                {{ formatThaiDate(detail.data.applyDate) }}
              </div>
            </div>
            <q-btn flat dense round icon="close" v-close-popup />
          </div>

          <q-separator />

          <div class="detail-body">
            <div class="detail-grid">
              <section class="detail-section">
                <div class="detail-section-title"><q-icon name="badge" /> ข้อมูลส่วนตัว</div>
                <dl class="detail-list">
                  <div>
                    <dt>เลขบัตรประชาชน</dt>
                    <dd>{{ detail.data.citizenId }}</dd>
                  </div>
                  <div>
                    <dt>วันเกิด / อายุ</dt>
                    <dd>
                      {{ formatThaiDate(detail.data.birthDate) }} ({{ detail.data.currentAge }} ปี)
                    </dd>
                  </div>
                  <div>
                    <dt>เพศ</dt>
                    <dd>{{ genderLabel(detail.data.gender) }}</dd>
                  </div>
                  <div>
                    <dt>เบอร์โทร</dt>
                    <dd>{{ detail.data.phone }}</dd>
                  </div>
                  <div>
                    <dt>อาชีพ</dt>
                    <dd>{{ detail.data.occupation || '-' }}</dd>
                  </div>
                  <div>
                    <dt>วันที่อนุมัติ</dt>
                    <dd>{{ formatThaiDate(detail.data.approvedDate) }}</dd>
                  </div>
                  <div>
                    <dt>หมายเหตุ</dt>
                    <dd>{{ detail.data.remark || '-' }}</dd>
                  </div>
                </dl>
              </section>

              <section class="detail-section">
                <div class="detail-section-title"><q-icon name="home" /> ที่อยู่</div>
                <dl class="detail-list">
                  <div>
                    <dt>บ้านเลขที่</dt>
                    <dd>{{ detail.data.household?.houseNo || '-' }}</dd>
                  </div>
                  <div>
                    <dt>หมู่ที่</dt>
                    <dd>{{ detail.data.household?.moo || '-' }}</dd>
                  </div>
                  <div>
                    <dt>ตำบล</dt>
                    <dd>{{ detail.data.household?.subdistrict || '-' }}</dd>
                  </div>
                  <div>
                    <dt>อำเภอ</dt>
                    <dd>{{ detail.data.household?.district || '-' }}</dd>
                  </div>
                  <div>
                    <dt>จังหวัด</dt>
                    <dd>{{ detail.data.household?.province || '-' }}</dd>
                  </div>
                  <div>
                    <dt>รหัสไปรษณีย์</dt>
                    <dd>{{ detail.data.household?.postcode || '-' }}</dd>
                  </div>
                </dl>

                <div class="detail-section-title q-mt-md">
                  <q-icon name="handshake" /> ผู้แนะนำ / ผู้ค้ำประกัน
                </div>
                <dl v-if="detail.data.guarantors.length" class="detail-list">
                  <div>
                    <dt>ชื่อ</dt>
                    <dd>{{ detail.data.guarantors[0]?.guarantorName }}</dd>
                  </div>
                  <div>
                    <dt>เบอร์โทร</dt>
                    <dd>{{ detail.data.guarantors[0]?.guarantorPhone || '-' }}</dd>
                  </div>
                  <div>
                    <dt>ความสัมพันธ์</dt>
                    <dd>{{ detail.data.guarantors[0]?.relationship || '-' }}</dd>
                  </div>
                </dl>
                <div v-else class="verify-caption">
                  ยังไม่มีข้อมูลผู้แนะนำ/ผู้ค้ำประกัน (แก้ไขข้อมูลสมาชิกเพื่อเพิ่ม)
                </div>

                <div class="detail-section-title q-mt-md">
                  <q-icon name="key" /> บัญชีเข้าสู่ระบบ
                </div>
                <dl class="detail-list">
                  <div>
                    <dt>ชื่อผู้ใช้</dt>
                    <dd>{{ detail.data.userAccount?.username || '-' }}</dd>
                  </div>
                  <div>
                    <dt>สถานะบัญชี</dt>
                    <dd>
                      {{
                        detail.data.userAccount
                          ? detail.data.userAccount.status === 'active'
                            ? 'ใช้งานได้'
                            : 'ถูกระงับ'
                          : '-'
                      }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>

            <!-- Fund-claim eligibility (active members only) -->
            <section v-if="detail.data.benefitEligibility" class="detail-section q-mt-md">
              <div class="detail-section-title">
                <q-icon name="savings" /> สิทธิ์ขอรับเงินจากกองทุน
                <q-badge
                  :color="detail.data.benefitEligibility.eligible ? 'green-2' : 'amber-2'"
                  :text-color="detail.data.benefitEligibility.eligible ? 'positive' : 'orange-10'"
                  class="q-ml-sm q-px-sm"
                  rounded
                >
                  {{
                    detail.data.benefitEligibility.eligible ? 'ครบทุกเงื่อนไข' : 'ยังไม่ครบเงื่อนไข'
                  }}
                </q-badge>
              </div>
              <div class="verify-form">
                <div
                  v-for="condition in benefitConditions(detail.data.benefitEligibility)"
                  :key="condition.label"
                  class="verify-item"
                  :class="condition.passed ? 'is-pass' : 'is-fail'"
                >
                  <q-icon
                    :name="condition.passed ? 'check_circle' : 'cancel'"
                    class="verify-icon"
                  />
                  <div class="verify-title">{{ condition.label }}</div>
                </div>
              </div>
            </section>

            <!-- Eligibility verification -->
            <section class="detail-section q-mt-md">
              <div class="detail-section-title">
                <q-icon name="fact_check" /> การตรวจสอบคุณสมบัติ
              </div>

              <div v-if="detail.data.status === 'pending'" class="verify-form">
                <q-checkbox
                  v-model="verifyForm.ageVerified"
                  :disable="!detailAgeCanCertify"
                  class="verify-check"
                >
                  <div class="verify-title">รับรองอายุผู้สมัคร</div>
                  <div class="verify-caption">{{ detailAgeCaption }}</div>
                </q-checkbox>

                <q-checkbox v-model="verifyForm.addressVerified" class="verify-check">
                  <div class="verify-title">ตรวจสอบที่อยู่แล้ว</div>
                  <div class="verify-caption">ยืนยันว่าผู้สมัครอาศัยอยู่ตามที่อยู่ข้างต้นจริง</div>
                </q-checkbox>
                <q-checkbox v-model="verifyForm.guarantorVerified" class="verify-check">
                  <div class="verify-title">ตรวจสอบผู้แนะนำ/ผู้ค้ำประกันแล้ว</div>
                  <div class="verify-caption">ยืนยันตัวตนและข้อมูลติดต่อของผู้แนะนำเรียบร้อย</div>
                </q-checkbox>

                <q-option-group
                  v-model="verifyForm.result"
                  inline
                  :options="[
                    { label: 'ผ่านการตรวจสอบ', value: 'passed', disable: !detailChecksOk },
                    { label: 'ไม่ผ่านการตรวจสอบ', value: 'failed' },
                  ]"
                />
                <q-input
                  v-model="verifyForm.note"
                  outlined
                  dense
                  autogrow
                  label="บันทึกผลการตรวจสอบ / เหตุผล"
                />

                <div class="verify-actions">
                  <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="fact_check"
                    label="บันทึกผลการตรวจสอบ"
                    :loading="verifyForm.busy"
                    @click="submitVerification"
                  />
                  <q-btn
                    unelevated
                    no-caps
                    color="positive"
                    icon="how_to_reg"
                    label="อนุมัติเป็นสมาชิก"
                    :disable="latestDetailVerification?.result !== 'passed'"
                    @click="openAction('approve', detail.data)"
                  >
                    <q-tooltip v-if="latestDetailVerification?.result !== 'passed'">
                      ต้องมีผลการตรวจสอบล่าสุดเป็น "ผ่าน" ก่อนอนุมัติ
                    </q-tooltip>
                  </q-btn>
                </div>
              </div>

              <div v-if="detail.data.verifications.length" class="history-list q-mt-sm">
                <div class="verify-title q-mb-xs">ประวัติการตรวจสอบ</div>
                <div
                  v-for="check in detail.data.verifications"
                  :key="check.id"
                  class="history-item"
                >
                  <q-icon
                    :name="check.result === 'passed' ? 'check_circle' : 'cancel'"
                    :class="check.result === 'passed' ? 'text-positive' : 'text-red-7'"
                  />
                  <div class="history-copy">
                    <div class="history-main">
                      {{ check.result === 'passed' ? 'ผ่านการตรวจสอบ' : 'ไม่ผ่านการตรวจสอบ' }}
                      <span class="history-date">{{ formatThaiDateTime(check.checkDate) }}</span>
                    </div>
                    <div class="verify-caption">
                      อายุ {{ check.ageYears }} ปี ({{
                        check.ageEligible ? 'รับรองอายุแล้ว' : 'ไม่ได้รับรองอายุ'
                      }}) - ที่อยู่{{ check.addressVerified ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ' }} -
                      ผู้แนะนำ{{ check.guarantorVerified ? 'ตรวจแล้ว' : 'ยังไม่ตรวจ' }}
                      <template v-if="check.note"> - {{ check.note }}</template>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else-if="detail.data.status !== 'pending'" class="verify-caption">
                ไม่มีประวัติการตรวจสอบ
              </div>
            </section>

            <section class="detail-section q-mt-md">
              <div class="detail-section-title"><q-icon name="attach_file" /> เอกสารประกอบ</div>
              <div class="document-upload-row q-mt-sm">
                <q-select
                  v-model="documentForm.documentType"
                  outlined
                  dense
                  emit-value
                  map-options
                  class="document-type-input"
                  label="ประเภทเอกสาร"
                  :options="documentTypeOptions"
                />
                <q-file
                  v-model="documentForm.file"
                  outlined
                  dense
                  clearable
                  class="document-file-input"
                  label="เลือกไฟล์ PDF/รูปภาพ ไม่เกิน 5MB"
                  accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                >
                  <template #prepend>
                    <q-icon name="upload_file" />
                  </template>
                </q-file>
                <q-btn
                  unelevated
                  no-caps
                  color="primary"
                  icon="cloud_upload"
                  label="อัปโหลด"
                  :disable="!documentForm.file || !documentForm.documentType"
                  :loading="documentForm.busy"
                  @click="submitMemberDocument"
                />
              </div>
              <q-input
                v-model="documentForm.note"
                outlined
                dense
                class="q-mt-sm"
                label="หมายเหตุเอกสาร (ไม่บังคับ)"
              />

              <div v-if="detail.data.documents.length" class="history-list q-mt-sm">
                <div
                  v-for="document in detail.data.documents"
                  :key="document.id"
                  class="history-item"
                >
                  <q-icon name="description" class="text-primary" />
                  <div class="history-copy">
                    <div class="history-main">
                      <a :href="document.fileUrl" target="_blank" rel="noopener">{{
                        document.originalName
                      }}</a>
                      <span class="history-date">{{
                        formatThaiDateTime(document.uploadedAt)
                      }}</span>
                    </div>
                    <div class="verify-caption">
                      {{ documentTypeLabel(document.documentType) }} -
                      {{ formatFileSize(document.fileSize) }}
                      <template v-if="document.note"> - {{ document.note }}</template>
                    </div>
                  </div>
                  <q-btn
                    v-if="canDeleteDocument(detail.data, document)"
                    flat
                    round
                    dense
                    icon="delete_outline"
                    color="red-7"
                    class="document-delete-btn"
                    :aria-label="`ลบเอกสาร ${document.originalName}`"
                    @click="askDeleteDocument(document)"
                  >
                    <q-tooltip>ลบเอกสาร</q-tooltip>
                  </q-btn>
                </div>
              </div>
              <div v-else class="verify-caption q-mt-sm">ยังไม่มีเอกสารประกอบ</div>
            </section>

            <section class="detail-section q-mt-md">
              <div class="detail-section-title">
                <q-icon name="manage_history" /> ประวัติสถานะสมาชิก
              </div>
              <div v-if="detail.data.statusHistories.length" class="history-list q-mt-sm">
                <div
                  v-for="entry in detail.data.statusHistories"
                  :key="entry.id"
                  class="history-item"
                >
                  <q-icon name="swap_horiz" class="text-primary" />
                  <div class="history-copy">
                    <div class="history-main">
                      {{ entry.fromStatus ? memberStatusLabel(entry.fromStatus) : 'เริ่มสมัคร' }}
                      →
                      {{ memberStatusLabel(entry.toStatus) }}
                      <span class="history-date">{{ formatThaiDateTime(entry.changedAt) }}</span>
                    </div>
                    <div class="verify-caption">
                      {{ entry.reason || 'ไม่มีหมายเหตุ' }}
                      <template v-if="entry.changedBy">
                        - ผู้ดำเนินการ #{{ entry.changedBy }}</template
                      >
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="verify-caption">ยังไม่มีประวัติสถานะ</div>
            </section>
          </div>

          <q-separator />

          <div class="detail-actions">
            <q-btn
              v-if="canManageMember(detail.data)"
              flat
              no-caps
              icon="edit"
              color="blue-9"
              label="แก้ไขข้อมูล"
              class="detail-action detail-action--edit"
              @click="openEdit(detail.data)"
            />
            <q-space v-if="$q.screen.gt.xs" />
            <q-btn
              v-if="canManageMember(detail.data)"
              flat
              no-caps
              icon="person_off"
              color="red-7"
              label="ยกเลิกสมาชิกภาพ"
              class="detail-action detail-action--cancel"
              @click="openAction('cancel', detail.data)"
            />
            <q-btn
              v-if="canManageMember(detail.data)"
              flat
              no-caps
              icon="volunteer_activism"
              color="deep-purple-7"
              label="แจ้งเสียชีวิต"
              class="detail-action detail-action--deceased"
              :to="`/admin/members/${detail.data.id}/deceased`"
            />
          </div>
        </template>
      </q-card>
    </q-dialog>

    <!-- ============ Delete member document ============ -->
    <MidDialog
      v-model="deleteDocumentOpen"
      size="sm"
      icon="delete_outline"
      badge="ลบเอกสาร"
      title="ลบเอกสารประกอบนี้?"
      caption="ไฟล์จะถูกลบออกจากระบบถาวร และกู้คืนไม่ได้"
      :persistent="deleteDocumentBusy"
    >
      <div v-if="documentToDelete" class="dialog-summary">
        <q-icon name="description" class="text-primary" />
        <div class="history-copy">
          <div class="history-main">{{ documentToDelete.originalName }}</div>
          <div class="verify-caption">
            {{ documentTypeLabel(documentToDelete.documentType) }} -
            {{ formatFileSize(documentToDelete.fileSize) }}
          </div>
        </div>
      </div>
      <template #actions>
        <MidButton
          variant="secondary"
          label="ยกเลิก"
          :disable="deleteDocumentBusy"
          @click="deleteDocumentOpen = false"
        />
        <MidButton
          variant="danger"
          icon="delete_outline"
          label="ลบเอกสาร"
          :loading="deleteDocumentBusy"
          @click="confirmDeleteDocument"
        />
      </template>
    </MidDialog>

    <!-- ============ Edit dialog ============ -->
    <!-- Blue like the แก้ไข buttons. Closing it with unsaved changes asks first:
         the ✕, ยกเลิก, a tap outside and Esc all go through requestCloseEdit. -->
    <MidDialog
      :model-value="editOpen"
      size="lg"
      tone="info"
      icon="edit"
      badge="แก้ไขข้อมูล"
      title="แก้ไขข้อมูลสมาชิก"
      :caption="editMemberLabel"
      :persistent="editBusy"
      @update:model-value="onEditDialogToggle"
      @show="snapshotEditForm"
    >
      <q-form ref="editFormRef" greedy @submit.prevent="submitEdit">
        <div class="verify-title">ข้อมูลส่วนตัว</div>
        <div class="form-grid q-mt-xs">
          <q-select
            v-model="editForm.prefix"
            outlined
            dense
            label="คำนำหน้า"
            class="span-4"
            :options="namePrefixOptions"
            emit-value
            map-options
            clearable
          />
          <q-input
            v-model="editForm.firstName"
            outlined
            dense
            label="ชื่อ *"
            class="span-4"
            :rules="[required]"
          />
          <q-input
            v-model="editForm.lastName"
            outlined
            dense
            label="นามสกุล *"
            class="span-4"
            :rules="[required]"
          />
          <MidDateField
            v-model="editForm.birthDate"
            label="วันเกิด *"
            class="span-4"
            required
            no-future
          />
          <q-select
            v-model="editForm.gender"
            outlined
            dense
            emit-value
            map-options
            label="เพศ"
            class="span-4"
            :options="[
              { label: 'ชาย', value: 'male' },
              { label: 'หญิง', value: 'female' },
            ]"
            clearable
          />
          <q-input
            v-model="editForm.phone"
            outlined
            dense
            label="เบอร์โทรศัพท์ *"
            class="span-4"
            :rules="[(v) => (v && v.trim().length >= 6) || 'กรอกเบอร์โทรอย่างน้อย 6 หลัก']"
          />
          <q-input v-model="editForm.occupation" outlined dense label="อาชีพ" class="span-6" />
          <q-input v-model="editForm.remark" outlined dense label="หมายเหตุ" class="span-6" />
        </div>

        <div class="verify-title q-mt-md">ที่อยู่</div>
        <div class="form-grid q-mt-xs">
          <q-input
            v-model="editForm.address.houseNo"
            outlined
            dense
            label="บ้านเลขที่"
            class="span-3"
          />
          <q-select
            v-model="editForm.address.moo"
            outlined
            dense
            emit-value
            map-options
            label="หมู่ที่"
            class="span-3"
            :options="mooOptions"
            clearable
          />
          <q-input
            v-model="editForm.address.subdistrict"
            outlined
            dense
            label="ตำบล"
            class="span-6"
          />
          <q-input
            v-model="editForm.address.district"
            outlined
            dense
            label="อำเภอ"
            class="span-4"
          />
          <q-input
            v-model="editForm.address.province"
            outlined
            dense
            label="จังหวัด"
            class="span-4"
          />
          <q-input
            v-model="editForm.address.postcode"
            outlined
            dense
            label="รหัสไปรษณีย์"
            class="span-4"
          />
        </div>

        <div class="verify-title q-mt-md">ผู้แนะนำ / ผู้ค้ำประกัน</div>
        <div class="form-grid q-mt-xs">
          <q-input
            v-model="editForm.guarantor.guarantorName"
            outlined
            dense
            label="ชื่อ-นามสกุล"
            class="span-6"
          />
          <q-input
            v-model="editForm.guarantor.guarantorPhone"
            outlined
            dense
            label="เบอร์โทร"
            class="span-3"
          />
          <q-input
            v-model="editForm.guarantor.relationship"
            outlined
            dense
            label="ความสัมพันธ์"
            class="span-3"
          />
        </div>

        <div class="dialog-actions dialog-actions--end">
          <MidButton variant="secondary" label="ยกเลิก" @click="requestCloseEdit" />
          <MidButton type="submit" icon="save" label="บันทึกการแก้ไข" :loading="editBusy" />
        </div>
      </q-form>
    </MidDialog>

    <MidDialog
      v-model="discardEditOpen"
      size="sm"
      tone="warning"
      icon="edit_off"
      badge="ยังไม่ได้บันทึก"
      title="ออกโดยไม่บันทึก?"
      caption="ข้อมูลที่แก้ไขไว้จะหายไป"
    >
      <template #actions>
        <MidButton variant="secondary" label="แก้ไขต่อ" @click="discardEditOpen = false" />
        <MidButton label="ออกโดยไม่บันทึก" @click="discardEdit" />
      </template>
    </MidDialog>

    <!-- ============ Approve / cancel confirm ============ -->
    <!-- Its own MID footer: the detail dialog's .detail-actions turns into a
         two-tile grid on phones and scattered these two buttons. -->
    <MidDialog
      v-model="actionOpen"
      size="sm"
      :icon="actionMeta[actionKind].icon"
      :badge="actionMeta[actionKind].title"
      :title="actionMeta[actionKind].question"
      :caption="actionMeta[actionKind].caption"
      :tone="actionMeta[actionKind].tone"
      :persistent="actionBusy"
    >
      <template v-if="actionMember">
        <div :class="['dialog-summary', `dialog-summary--${actionMeta[actionKind].tone}`]">
          <q-icon name="person" />
          <div class="history-copy">
            <div class="history-main">{{ memberFullName(actionMember) }}</div>
            <div class="verify-caption">รหัสสมาชิก {{ actionMember.memberCode }}</div>
          </div>
        </div>

        <q-input
          v-if="actionKind === 'cancel'"
          v-model="actionNote"
          outlined
          dense
          autogrow
          class="q-mt-md"
          label="เหตุผล / หมายเหตุ (ไม่บังคับ)"
        />
      </template>
      <template #actions>
        <MidButton
          variant="secondary"
          label="ยกเลิก"
          :disable="actionBusy"
          @click="actionOpen = false"
        />
        <MidButton
          :variant="actionMeta[actionKind].variant"
          :icon="actionMeta[actionKind].icon"
          :label="actionMeta[actionKind].confirmLabel"
          :loading="actionBusy"
          @click="confirmAction"
        />
      </template>
    </MidDialog>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useQuasar, type QForm } from 'quasar';
import AdminPanelHeader from 'src/components/admin/AdminPanelHeader.vue';
import AdminGridCard from 'src/components/admin/AdminGridCard.vue';
import { apiErrorMessage } from 'src/utils/apiError';
import { required } from 'src/utils/validators';
import { namePrefixOptions } from 'src/utils/namePrefix';
import {
  useCommitteeStore,
  type CommitteeBenefitEligibility,
  type CommitteeMember,
  type CommitteeMemberDetail,
  type CommitteeMemberDocument,
  type CommitteeVerification,
} from 'src/stores/committeeStore';
import { useVillageAreaStore, villageMooOptions } from 'src/stores/villageAreaStore';
import {
  MidButton,
  MidDateField,
  MidDialog,
  MidFilterBar,
  midOptionLabel,
  midNotify,
  type MidActiveFilter,
  MidTablePagination,
  useRememberedPagination,
  MID_ROWS_PER_PAGE_OPTIONS,
} from 'components/MID';
import type { QTableProps } from 'quasar';
import {
  MEMBER_STATUS_LABELS,
  formatThaiDate,
  formatThaiDateTime,
  memberFullName,
  memberStatusColor,
  memberStatusLabel,
} from '../municipality/format';

const $q = useQuasar();
const store = useCommitteeStore();

const summary = computed(() => store.summary);
const members = computed(() => store.members);
const detail = computed(() => store.memberDetail);
const villageAreaStore = useVillageAreaStore();
const selectedVillageAreaId = ref<number | null>(null);

const villageOptions = computed(() => {
  return [
    { label: 'รวมทุกหมู่บ้าน', value: null },
    ...villageAreaStore.items.map((v) => ({
      label: `หมู่ ${v.moo} ${v.villageName}`,
      value: v.id,
    }))
  ];
});

const mooOptions = computed(() => villageMooOptions(villageAreaStore.items));

onMounted(() => {
  void villageAreaStore.fetchActive();
});

// --- List filters -------------------------------------------------------------

const search = ref('');
const status = ref<string | null>(null);
let filterTimer: number | undefined;

const statusOptions = Object.entries(MEMBER_STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const activeFilters = computed<MidActiveFilter[]>(() =>
  status.value
    ? [{ key: 'status', label: 'สถานะ', value: midOptionLabel(statusOptions, status.value) }]
    : [],
);

function clearFilter(key: string) {
  if (key === 'status') status.value = null;
  applyFilters();
}

function clearAllFilters() {
  status.value = null;
  selectedVillageAreaId.value = null;
  applyFilters();
}

const pagination = useRememberedPagination('admin-members', {
  page: 1,
  rowsPerPage: 20,
  rowsNumber: 0,
});

const columns: QTableProps['columns'] = [
  { name: 'memberCode', align: 'left', label: 'รหัส', field: 'memberCode' },
  {
    name: 'name',
    align: 'left',
    label: 'ชื่อ-นามสกุล',
    field: (row: CommitteeMember) => memberFullName(row),
  },
  { name: 'citizenId', align: 'left', label: 'เลขบัตรประชาชน', field: 'citizenId' },
  { name: 'phone', align: 'left', label: 'เบอร์โทร', field: 'phone' },
  {
    name: 'address',
    align: 'left',
    label: 'ที่อยู่ (หมู่ที่)',
    field: (row: CommitteeMember) =>
      row.household
        ? `หมู่ ${row.household.moo ?? '-'} ${row.household.subdistrict ?? ''}`.trim()
        : '-',
  },
  {
    name: 'applyDate',
    align: 'left',
    label: 'วันที่สมัคร',
    field: (row: CommitteeMember) => formatThaiDate(row.applyDate),
  },
  { name: 'status', align: 'center', label: 'สถานะ', field: 'status' },
  { name: 'benefit', align: 'center', label: 'สิทธิ์ขอรับเงินกองทุน', field: () => '' },
  { name: 'verification', align: 'center', label: 'ผลตรวจคุณสมบัติ', field: () => '' },
  { name: 'actions', align: 'right', label: 'จัดการ', field: () => '' },
];

const summaryCards = computed(() => {
  const data = summary.value.data;
  return [
    {
      label: 'สมาชิกทั้งหมด',
      value: data?.total.toLocaleString() ?? '-',
      icon: 'people',
      iconClass: 'icon-blue',
    },
    {
      label: 'รอตรวจสอบ/อนุมัติ',
      value: (data?.byStatus['pending'] ?? 0).toLocaleString(),
      icon: 'pending_actions',
      iconClass: 'icon-amber',
    },
    {
      label: 'สถานะใช้งาน',
      value: (data?.byStatus['active'] ?? 0).toLocaleString(),
      icon: 'how_to_reg',
      iconClass: 'icon-green',
    },
    {
      label: 'ครบเงื่อนไขขอรับเงินกองทุน',
      value: (data?.benefitEligible ?? 0).toLocaleString(),
      icon: 'verified',
      iconClass: 'icon-blue',
    },
  ];
});

function latestVerification(member: CommitteeMember): CommitteeVerification | undefined {
  return member.verifications?.[0];
}

function verificationMeta(member: CommitteeMember) {
  const latest = latestVerification(member);
  if (!latest) return { label: 'ยังไม่ตรวจสอบ', color: 'grey-3', textColor: 'grey-8' };
  return latest.result === 'passed'
    ? { label: 'ผ่านการตรวจสอบ', color: 'green-2', textColor: 'positive' }
    : { label: 'ไม่ผ่านการตรวจสอบ', color: 'red-2', textColor: 'red-9' };
}

// An avatarUrl can outlive the file it points at (upload deleted, storage not
// served). Without this the <img> would sit there broken, because `v-if`
// already decided the letter fallback isn't needed.
const brokenAvatars = reactive(new Set<number>());

function markAvatarBroken(memberId: number) {
  brokenAvatars.add(memberId);
}

function memberAddressLabel(member: CommitteeMember): string {
  if (!member.household) return '-';
  return `หมู่ ${member.household.moo ?? '-'} ${member.household.subdistrict ?? ''}`.trim();
}

// The three fund-claim conditions spelled out for the badge tooltip and the
// detail dialog: each one shows the member's own figure against what's required.
function benefitConditions(eligibility: CommitteeBenefitEligibility) {
  const { fundCheck, membershipAgeCheck, wasteSaleActivityCheck } = eligibility;
  return [
    {
      passed: fundCheck.passed,
      label: `เงินสะสม ${fundCheck.amount.toLocaleString()} บาท (ต้องมีอย่างน้อย ${fundCheck.required} บาท)`,
    },
    {
      passed: membershipAgeCheck.passed,
      label: `อายุสมาชิก ${membershipAgeCheck.months} เดือน (ต้องครบ ${membershipAgeCheck.required} เดือน)`,
    },
    {
      passed: wasteSaleActivityCheck.passed,
      label: `ขายขยะ ${wasteSaleActivityCheck.activeMonths} เดือน จากที่ต้องมี ${wasteSaleActivityCheck.required} เดือน ใน ${wasteSaleActivityCheck.windowMonths} เดือนล่าสุด`,
    },
  ];
}

// Edit / cancel-membership / mark-deceased are all gated by the same rule:
// a member already in a terminal status (resigned or deceased) can't be
// managed further.
function canManageMember(member: CommitteeMember): boolean {
  return member.status !== 'resigned' && member.status !== 'deceased';
}

function genderLabel(gender: string | null): string {
  if (gender === 'male') return 'ชาย';
  if (gender === 'female') return 'หญิง';
  return gender || '-';
}

function loadSummary() {
  void store.fetchSummary(
    selectedVillageAreaId.value ? { villageAreaId: selectedVillageAreaId.value } : {}
  );
}

async function loadMembers() {
  const applied = await store.fetchMembers({
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
    search: search.value.trim() || undefined,
    status: status.value ?? undefined,
    villageAreaId: selectedVillageAreaId.value ?? undefined,
  });
  if (applied) {
    pagination.value.rowsNumber = members.value.data?.total ?? 0;
  }
}

function reloadAll() {
  loadSummary();
  void loadMembers();
  if (detailOpen.value && detailMemberId.value !== null) {
    void store.fetchMemberDetail(detailMemberId.value);
  }
}

function applyFilters() {
  if (filterTimer) window.clearTimeout(filterTimer);
  filterTimer = window.setTimeout(() => {
    filterTimer = undefined;
    pagination.value.page = 1;
    void loadMembers();
  }, 250);
}

function onTableRequest(props: { pagination: { page: number; rowsPerPage: number } }) {
  pagination.value.page = props.pagination.page;
  pagination.value.rowsPerPage = props.pagination.rowsPerPage;
  void loadMembers();
}

// --- Detail + verification ------------------------------------------------------

const detailOpen = ref(false);
const detailMemberId = ref<number | null>(null);

const verifyForm = reactive({
  ageVerified: false,
  addressVerified: false,
  guarantorVerified: false,
  result: 'failed' as 'passed' | 'failed',
  note: '',
  busy: false,
});

// The system only works the age out; the age itself is certified here, in
// ageRule's usual range or not.
const detailAgeCanCertify = computed(() => !!detail.value.data);

const detailAgeCaption = computed(() => {
  const data = detail.value.data;
  if (!data) return '';
  const { min, max } = data.ageRule;
  if (data.currentAge < min || data.currentAge > max) {
    return `ระบบคำนวณอายุได้ ${data.currentAge} ปี นอกเกณฑ์ปกติ ${min}-${max} ปี พิจารณารับรองได้`;
  }
  return `ระบบคำนวณอายุได้ ${data.currentAge} ปี (เกณฑ์ปกติ ${min}-${max} ปี)`;
});

const detailChecksOk = computed(
  () => verifyForm.ageVerified && verifyForm.addressVerified && verifyForm.guarantorVerified,
);

const latestDetailVerification = computed(() => detail.value.data?.verifications?.[0]);

const documentTypeOptions = [
  { label: 'สำเนาบัตรประชาชน', value: 'citizen_id' },
  { label: 'ทะเบียนบ้าน', value: 'household_registration' },
  { label: 'เอกสารผู้รับรอง', value: 'guarantor' },
  // Also the type the deceased-member flow saves its required attachment as.
  { label: 'ใบมรณบัตร', value: 'death_certificate' },
  { label: 'เอกสารอื่น ๆ', value: 'other' },
];

const documentForm = reactive({
  documentType: 'citizen_id',
  file: null as File | null,
  note: '',
  busy: false,
});

function documentTypeLabel(value: string): string {
  return documentTypeOptions.find((option) => option.value === value)?.label ?? value;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function openDetail(member: CommitteeMember) {
  detailMemberId.value = member.id;
  verifyForm.ageVerified = false;
  verifyForm.addressVerified = false;
  verifyForm.guarantorVerified = false;
  verifyForm.result = 'failed';
  verifyForm.note = '';
  documentForm.documentType = 'citizen_id';
  documentForm.file = null;
  documentForm.note = '';
  detailOpen.value = true;
  void store.fetchMemberDetail(member.id);
}

async function submitMemberDocument() {
  if (detailMemberId.value === null || !documentForm.file || !documentForm.documentType) return;

  documentForm.busy = true;
  try {
    await store.uploadMemberDocument(detailMemberId.value, {
      documentType: documentForm.documentType,
      file: documentForm.file,
      ...(documentForm.note.trim() ? { note: documentForm.note.trim() } : {}),
    });
    documentForm.file = null;
    documentForm.note = '';
    midNotify({ type: 'success', message: 'อัปโหลดเอกสารประกอบแล้ว' });
    void store.fetchMemberDetail(detailMemberId.value);
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'อัปโหลดเอกสารไม่สำเร็จ') });
  } finally {
    documentForm.busy = false;
  }
}

const deleteDocumentOpen = ref(false);
const deleteDocumentBusy = ref(false);
const documentToDelete = ref<CommitteeMemberDocument | null>(null);

// The death certificate behind a recorded death is the evidence for the
// funeral-fund deductions - the API refuses to delete it, so no button either.
function canDeleteDocument(member: CommitteeMemberDetail, document: CommitteeMemberDocument) {
  return !(document.documentType === 'death_certificate' && member.status === 'deceased');
}

function askDeleteDocument(document: CommitteeMemberDocument) {
  documentToDelete.value = document;
  deleteDocumentOpen.value = true;
}

async function confirmDeleteDocument() {
  if (detailMemberId.value === null || !documentToDelete.value) return;

  deleteDocumentBusy.value = true;
  try {
    await store.deleteMemberDocument(detailMemberId.value, documentToDelete.value.id);
    deleteDocumentOpen.value = false;
    midNotify({ type: 'success', message: 'ลบเอกสารแล้ว' });
    void store.fetchMemberDetail(detailMemberId.value);
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ลบเอกสารไม่สำเร็จ') });
  } finally {
    deleteDocumentBusy.value = false;
  }
}

async function submitVerification() {
  if (detailMemberId.value === null) return;
  if (verifyForm.result === 'passed' && !detailChecksOk.value) {
    verifyForm.result = 'failed';
  }

  verifyForm.busy = true;
  try {
    await store.recordVerification(detailMemberId.value, {
      ageVerified: verifyForm.ageVerified,
      addressVerified: verifyForm.addressVerified,
      guarantorVerified: verifyForm.guarantorVerified,
      result: verifyForm.result,
      ...(verifyForm.note.trim() ? { note: verifyForm.note.trim() } : {}),
    });
    midNotify({ type: 'success', message: 'บันทึกผลการตรวจสอบคุณสมบัติแล้ว' });
    reloadAll();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกผลการตรวจสอบไม่สำเร็จ') });
  } finally {
    verifyForm.busy = false;
  }
}

// --- Edit -----------------------------------------------------------------------

const editOpen = ref(false);
const editBusy = ref(false);
const editFormRef = ref<QForm | null>(null);
const editMemberId = ref<number | null>(null);
// "Name · รหัสสมาชิก 067" under the dialog title.
const editMemberLabel = ref('');
// The form as it stood once the dialog finished opening; any difference from it
// is an unsaved edit.
const editSnapshot = ref('');
const discardEditOpen = ref(false);

const editForm = reactive({
  prefix: null as string | null,
  firstName: '',
  lastName: '',
  birthDate: '',
  gender: null as string | null,
  phone: '',
  occupation: '',
  remark: '',
  address: { houseNo: '', moo: '', subdistrict: '', district: '', province: '', postcode: '' },
  guarantor: { guarantorName: '', guarantorPhone: '', relationship: '' },
});

function openEdit(member: CommitteeMember | CommitteeMemberDetail) {
  editMemberId.value = member.id;
  editForm.prefix = member.prefix;
  editForm.firstName = member.firstName;
  editForm.lastName = member.lastName;
  editForm.birthDate = member.birthDate.slice(0, 10);
  editForm.gender = member.gender;
  editForm.phone = member.phone;
  editForm.occupation = member.occupation ?? '';
  editForm.remark = member.remark ?? '';
  editForm.address.houseNo = member.household?.houseNo ?? '';
  // Always the committee's own village (the list is scoped to it) - shown
  // read-only so the address can't be moved out of the village.
  editForm.address.moo = member.household?.moo ?? '';
  editForm.address.subdistrict = member.household?.subdistrict ?? '';
  editForm.address.district = member.household?.district ?? '';
  editForm.address.province = member.household?.province ?? '';
  editForm.address.postcode = member.household?.postcode ?? '';
  const guarantor = member.guarantors?.[0];
  editForm.guarantor.guarantorName = guarantor?.guarantorName ?? '';
  editForm.guarantor.guarantorPhone = guarantor?.guarantorPhone ?? '';
  editForm.guarantor.relationship = guarantor?.relationship ?? '';
  // \u00a0 (no-break space) leaves the break after "·" as the only one outside
  // the name, so a phone wraps to "รหัส 067" rather than splitting it.
  editMemberLabel.value = `${memberFullName(member)}\u00a0· รหัส\u00a0${member.memberCode}`;
  editSnapshot.value = '';
  editOpen.value = true;
}

// Taken on the dialog's show event, after the fields have mounted.
function snapshotEditForm() {
  editSnapshot.value = JSON.stringify(editForm);
}

const isEditDirty = computed(
  () => editSnapshot.value !== '' && JSON.stringify(editForm) !== editSnapshot.value,
);

function onEditDialogToggle(open: boolean) {
  if (open) editOpen.value = true;
  else requestCloseEdit();
}

function requestCloseEdit() {
  if (editBusy.value) return;
  if (isEditDirty.value) discardEditOpen.value = true;
  else editOpen.value = false;
}

function discardEdit() {
  discardEditOpen.value = false;
  editOpen.value = false;
}

async function submitEdit() {
  if (editMemberId.value === null) return;
  const valid = await editFormRef.value?.validate();
  if (!valid) return;

  editBusy.value = true;
  try {
    await store.updateMember(editMemberId.value, {
      prefix: editForm.prefix ?? undefined,
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      birthDate: editForm.birthDate,
      gender: editForm.gender ?? undefined,
      phone: editForm.phone.trim(),
      occupation: editForm.occupation.trim() || undefined,
      remark: editForm.remark.trim() || undefined,
      address: {
        houseNo: editForm.address.houseNo.trim() || undefined,
        moo: (editForm.address.moo ?? '').trim() || undefined,
        subdistrict: editForm.address.subdistrict.trim() || undefined,
        district: editForm.address.district.trim() || undefined,
        province: editForm.address.province.trim() || undefined,
        postcode: editForm.address.postcode.trim() || undefined,
      },
      ...(editForm.guarantor.guarantorName.trim()
        ? {
            guarantor: {
              guarantorName: editForm.guarantor.guarantorName.trim(),
              guarantorPhone: editForm.guarantor.guarantorPhone.trim() || undefined,
              relationship: editForm.guarantor.relationship.trim() || undefined,
            },
          }
        : {}),
    });
    midNotify({ type: 'success', message: 'บันทึกการแก้ไขข้อมูลสมาชิกแล้ว' });
    editOpen.value = false;
    reloadAll();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'บันทึกการแก้ไขไม่สำเร็จ') });
  } finally {
    editBusy.value = false;
  }
}

// --- Approve / cancel ---------------------------------------------------------

type ActionKind = 'approve' | 'cancel';

const actionOpen = ref(false);
const actionBusy = ref(false);
const actionKind = ref<ActionKind>('approve');
const actionMember = ref<CommitteeMember | CommitteeMemberDetail | null>(null);
const actionNote = ref('');

const actionMeta: Record<
  ActionKind,
  {
    title: string;
    question: string;
    caption: string;
    icon: string;
    variant: 'primary' | 'danger';
    tone: 'default' | 'danger';
    confirmLabel: string;
    success: string;
  }
> = {
  approve: {
    title: 'อนุมัติสมาชิก',
    question: 'อนุมัติผู้สมัครรายนี้?',
    caption: 'ผู้สมัครจะได้เป็นสมาชิกธนาคารขยะ',
    icon: 'how_to_reg',
    variant: 'primary',
    tone: 'default',
    confirmLabel: 'อนุมัติ',
    success: 'อนุมัติสมาชิกเรียบร้อย',
  },
  cancel: {
    title: 'ยกเลิกสมาชิกภาพ',
    question: 'ยกเลิกสมาชิกรายนี้?',
    // \u2060 (word joiner): on the narrowest phones "ด้วย" never wraps onto a line alone.
    caption: 'บัญชีเข้าสู่ระบบจะถูกระงับ\u2060ด้วย',
    icon: 'person_off',
    variant: 'danger',
    tone: 'danger',
    confirmLabel: 'ยกเลิกสมาชิกภาพ',
    success: 'ยกเลิกสมาชิกภาพแล้ว',
  },
};

function openAction(kind: ActionKind, member: CommitteeMember | CommitteeMemberDetail) {
  actionKind.value = kind;
  actionMember.value = member;
  actionNote.value = '';
  actionOpen.value = true;
}

async function confirmAction() {
  if (!actionMember.value) return;
  const id = actionMember.value.id;
  const note = actionNote.value.trim() || undefined;

  actionBusy.value = true;
  try {
    if (actionKind.value === 'approve') await store.approveMember(id);
    else if (actionKind.value === 'cancel') await store.cancelMember(id, note);

    midNotify({ type: 'success', message: actionMeta[actionKind.value].success });
    actionOpen.value = false;
    reloadAll();
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'ดำเนินการไม่สำเร็จ') });
  } finally {
    actionBusy.value = false;
  }
}

onMounted(() => {
  loadSummary();
  void loadMembers();
});

// Load when a village is selected or cleared
watch(selectedVillageAreaId, (newId, oldId) => {
  if (newId !== oldId) {
    loadSummary();
    void loadMembers();
  }
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
});
</script>

<style lang="scss" scoped>
@use './theme' as *;
@use '../../components/MID/mid.variables' as mid;

.village-select {
  flex: 0 1 260px;
  min-width: 200px;
}

.village-chip {
  background: #e6f5ed;
  color: #0b7a47;
  font-weight: 700;
  border-radius: 10px;
}

.member-table :deep(tbody tr) {
  cursor: pointer;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.row-avatar {
  color: #0d7a44;
  background: #eaf6ec;
  border: 1px solid #dcefe1;
  font-size: 16px;
  font-weight: 800;
}

.card-avatar {
  font-size: 19px;
}

.name-text {
  font-weight: 600;
  white-space: nowrap;
}

.benefit-tooltip {
  max-width: 340px;
  font-size: 12.5px;
  font-weight: 700;
}

.benefit-tooltip-title {
  margin-bottom: 4px;
  font-weight: 900;
}

.benefit-tooltip-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  line-height: 1.5;
}

.action-btns {
  display: inline-flex;
  gap: 2px;
}

// --- Dialogs ---------------------------------------------------------------------

.detail-card {
  width: min(860px, calc(100vw - 32px));
  max-width: min(860px, calc(100vw - 32px));
  border-radius: 18px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px 14px;
}

.detail-name {
  color: #10241a;
  font-size: 19px;
  font-weight: 950;
}

.detail-sub {
  margin-top: 4px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 800;
}

.detail-body {
  max-height: min(64vh, 620px);
  padding: 16px 22px;
  overflow-y: auto;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.detail-section {
  padding: 14px 16px;
  border: 1px solid rgba(7, 95, 56, 0.1);
  border-radius: 14px;
  background: #fbfdfb;
}

.detail-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: #087f49;
  font-size: 14px;
  font-weight: 950;
}

.detail-list {
  display: grid;
  gap: 6px;
  margin: 0;
}

.detail-list div {
  display: flex;
  gap: 10px;
}

.detail-list dt {
  min-width: 128px;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 800;
}

.detail-list dd {
  margin: 0;
  color: #1c2b23;
  font-size: 13px;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px 16px;
}

.verify-form {
  display: grid;
  gap: 10px;
}

.verify-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid rgba(7, 95, 56, 0.1);
}

.verify-item.is-pass {
  background: #f2faf4;
}

.verify-item.is-fail {
  background: #fdf3f3;
  border-color: rgba(180, 35, 35, 0.16);
}

.verify-icon {
  margin-top: 2px;
  font-size: 22px;
}

.is-pass .verify-icon {
  color: #13b84f;
}

.is-fail .verify-icon {
  color: #d64545;
}

.verify-title {
  color: #1c2b23;
  font-size: 14px;
  font-weight: 900;
}

.verify-caption {
  margin-top: 2px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
}

.verify-check {
  align-items: flex-start;
}

.verify-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
}

.document-upload-row {
  display: grid;
  grid-template-columns: minmax(170px, 220px) minmax(220px, 1fr) auto;
  gap: 10px;
  align-items: start;
}

.document-type-input,
.document-file-input {
  min-width: 0;
}

.history-list {
  display: grid;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #f7faf8;
}

// Takes the row's free width, so a trailing action (the delete-document button)
// sits at the right edge.
.history-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.history-item .q-icon {
  margin-top: 2px;
  font-size: 18px;
}

.history-main {
  color: #1c2b23;
  font-size: 13px;
  font-weight: 900;
  // Camera/upload file names are one long word - let them wrap instead of
  // widening the row past the dialog (and pushing the delete button off it).
  overflow-wrap: anywhere;
}

// MID confirmations restate what they act on: the file, or the member.
.dialog-summary {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid mid.$mid-border;
  border-radius: 12px;
  background: mid.$mid-primary-surface;
}

.dialog-summary--default .q-icon {
  color: mid.$mid-primary;
}

// Inside the red (tone="danger") cancel-membership dialog.
.dialog-summary--danger {
  border-color: #fecaca;
  background: #fef2f2;

  .q-icon {
    color: #dc2626;
  }
}

.document-delete-btn {
  align-self: center;
  flex-shrink: 0;
}

.history-date {
  margin-left: 6px;
  color: #98a19d;
  font-size: 12px;
  font-weight: 700;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px 14px;
}

.span-3 {
  grid-column: span 3;
}
.span-4 {
  grid-column: span 4;
}
.span-6 {
  grid-column: span 6;
}

@media (max-width: 760px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .document-upload-row {
    grid-template-columns: 1fr;
  }

  .span-3,
  .span-4 {
    grid-column: span 6;
  }
}

// Phone - same 599px line as the table's grid mode ($q.screen.lt.sm), so the
// list, the detail dialog and the edit dialog all switch together (as on the
// committee's member page).
@media (max-width: 599px) {
  // Edit form: one field per row.
  .span-3,
  .span-4,
  .span-6 {
    grid-column: span 12;
  }

  // --- The detail dialog gets its width back ---------------------------------
  .detail-card,

  .detail-head {
    padding: 14px 14px 10px;
  }

  .detail-name {
    font-size: 17px;
  }

  .detail-body,

  // The two-row action footer has to stay inside the card: the card is capped at
  // the screen height and the body takes whatever is left, scrolling inside.
  .detail-card {
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 24px);
    max-height: calc(100dvh - 24px);
  }

  .detail-body {
    flex: 1 1 auto;
    min-height: 0;
    max-height: none;
  }

  .detail-grid {
    gap: 10px;
  }

  .detail-section {
    padding: 11px 12px;
  }

  .detail-list dt {
    min-width: 88px;
  }

  // Same footer as CommitteeMembersPage: two per row, each a rounded tile in
  // its own soft tint (MidButton's radius and weight, MID colours), so every
  // label stays on one line.
  .detail-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    padding: 10px 12px calc(12px + env(safe-area-inset-bottom));
  }

  .detail-action {
    min-width: 0;
    min-height: 44px;
    padding: 0 10px;
    border-radius: 12px;
    font-weight: 800;
  }

  // An odd tile out (here: แจ้งเสียชีวิต as the third action) takes the full row.
  .detail-action:last-child:nth-child(odd) {
    grid-column: span 2;
  }

  .detail-action :deep(.q-btn__content) {
    flex-wrap: nowrap;
    gap: 2px;
    font-size: 13px;
    white-space: nowrap;
  }

  .detail-action :deep(.q-icon) {
    font-size: 20px;
  }

  // Blue like the list cards' แก้ไข button and the edit dialog.
  .detail-action--edit {
    background: #e8f1fc;
  }

  .detail-action--cancel {
    background: rgba(mid.$mid-danger, 0.09);
  }

  .detail-action--deceased {
    background: mid.$mid-purple-soft;
  }
}

// Form dialog footers (edit). They sit inside their q-form so the
// submit button still validates; the layout follows MidDialog's own actions.
.dialog-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 24px;
}

.dialog-actions--end {
  display: flex;
  justify-content: flex-end;
}

// MidDialog stacks its actions at this width too.
@media (max-width: 520px) {
  .dialog-actions,
  .dialog-actions--end {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
