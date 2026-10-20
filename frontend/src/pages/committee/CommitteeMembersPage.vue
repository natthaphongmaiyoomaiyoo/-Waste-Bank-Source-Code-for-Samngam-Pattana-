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
            <p v-if="villageLabel">
              <span class="hero-village">{{ villageLabel }}</span>
            </p>
          </div>
          <q-btn
            unelevated
            no-caps
            icon="person_add"
            label="เพิ่มสมาชิกใหม่"
            class="hero-add-btn"
            to="/committee/add-member"
          />
        </div>
      </section>

      <!-- Without a village assignment the backend refuses every committee
           endpoint, so say why instead of showing a generic load error. -->
      <q-banner v-if="!villageLabel" rounded class="bg-amber-1 text-amber-9 error-banner">
        <template #avatar><q-icon name="warning" /></template>
        บัญชีนี้ยังไม่ได้ถูกกำหนดหมู่บ้านที่รับผิดชอบ
        กรุณาติดต่อผู้ดูแลระบบเพื่อผูกหมู่บ้านก่อนใช้งาน
      </q-banner>

      <q-banner v-else-if="summary.error" rounded class="bg-red-1 text-red-9 error-banner">
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
        <div class="panel-head">
          <div>
            <div class="panel-title">ทะเบียนสมาชิก</div>
          </div>
        </div>

        <div class="filter-row">
          <MidFilterBar
            v-model:search="search"
            search-label="ค้นหา (ชื่อ / เลขบัตร / เบอร์โทร / รหัสสมาชิก)"
            title="กรองทะเบียนสมาชิก"
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
              <!-- A committee only ever sees its own village, so this is a label,
                   not a filter (the backend enforces the same restriction). -->
              <q-chip v-if="villageLabel" square icon="holiday_village" class="village-chip">
                {{ villageLabel }}
              </q-chip>
            </template>
          </MidFilterBar>
        </div>

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
          :rows="members.data?.items ?? []"
          :columns="columns"
          :grid="isPhone"
          :loading="members.loading"
          v-model:pagination="pagination"
          :rows-per-page-options="MID_ROWS_PER_PAGE_OPTIONS"
          @request="onTableRequest"
          @row-click="(_evt, row) => openDetail(row as CommitteeMember)"
        >
          <template #pagination="scope">
            <MidTablePagination :pagination="scope.pagination" :pages-number="scope.pagesNumber" />
          </template>
          <!-- Phone: ten columns don't fit a phone width, so each member becomes
               a card. Tapping it opens the same detail dialog as the table row;
               the footer keeps the management actions within thumb reach. -->
          <template #item="props">
            <div class="member-card-wrap col-12">
              <article class="member-card" @click="openDetail(props.row as CommitteeMember)">
                <div class="member-card-head">
                  <q-avatar size="46px" class="member-card-avatar">
                    <img
                      v-if="props.row.avatarUrl && !brokenAvatars.has(props.row.id)"
                      :src="props.row.avatarUrl"
                      :alt="memberFullName(props.row as CommitteeMember)"
                      @error="markAvatarBroken(props.row.id)"
                    />
                    <!-- No photo uploaded: the first letter of the given name,
                         same fallback the member profile header uses. -->
                    <span v-else>{{ props.row.firstName.charAt(0) }}</span>
                  </q-avatar>
                  <div class="member-card-title">
                    <div class="member-card-name">
                      {{ memberFullName(props.row as CommitteeMember) }}
                    </div>
                    <div class="member-card-sub">
                      รหัส {{ props.row.memberCode }} · {{ props.row.phone }}
                    </div>
                  </div>
                </div>

                <div class="member-card-chips">
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
                  <q-badge
                    v-if="showsFundShortfall(props.row as CommitteeMember)"
                    color="red-1"
                    text-color="red-9"
                    class="q-px-sm q-py-xs"
                    rounded
                  >
                    เงินสะสมไม่ครบ
                  </q-badge>
                </div>

                <dl class="member-card-rows">
                  <div>
                    <dt>เลขบัตรประชาชน</dt>
                    <dd>{{ props.row.citizenId }}</dd>
                  </div>
                  <div>
                    <dt>ที่อยู่</dt>
                    <dd>{{ memberAddressLabel(props.row as CommitteeMember) }}</dd>
                  </div>
                  <div>
                    <dt>วันที่สมัคร</dt>
                    <dd>{{ formatThaiDate(props.row.applyDate) }}</dd>
                  </div>
                  <div v-if="props.row.benefitEligibility">
                    <dt>สิทธิ์ขอรับเงินกองทุน</dt>
                    <dd>
                      <q-badge
                        :color="props.row.benefitEligibility.eligible ? 'green-2' : 'amber-2'"
                        :text-color="
                          props.row.benefitEligibility.eligible ? 'positive' : 'orange-10'
                        "
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
                </dl>

                <!-- click.stop: these act on the member, not on "open detail". -->
                <div class="member-card-actions" @click.stop>
                  <q-btn
                    unelevated
                    no-caps
                    size="sm"
                    icon="visibility"
                    label="รายละเอียด"
                    class="member-card-btn is-detail"
                    @click="openDetail(props.row as CommitteeMember)"
                  />
                  <q-btn
                    v-if="canManageMember(props.row)"
                    unelevated
                    no-caps
                    size="sm"
                    icon="edit"
                    label="แก้ไข"
                    class="member-card-btn is-edit"
                    @click="openEdit(props.row as CommitteeMember)"
                  />
                  <q-btn
                    v-if="canResetPassword(props.row)"
                    unelevated
                    no-caps
                    size="sm"
                    icon="lock_reset"
                    label="เปลี่ยนรหัสผ่าน"
                    class="member-card-btn is-password"
                    @click="openPassword(props.row as CommitteeMember)"
                  />
                  <q-btn
                    v-if="props.row.status === 'pending'"
                    unelevated
                    no-caps
                    size="sm"
                    icon="how_to_reg"
                    label="อนุมัติ"
                    class="member-card-btn is-approve"
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
                    class="member-card-btn is-cancel"
                    @click="openAction('cancel', props.row as CommitteeMember)"
                  />
                  <q-btn
                    v-if="canManageMember(props.row)"
                    unelevated
                    no-caps
                    size="sm"
                    icon="volunteer_activism"
                    label="แจ้งเสียชีวิต"
                    class="member-card-btn is-deceased"
                    :to="`/committee/members/${props.row.id}/deceased`"
                  />
                </div>
              </article>
            </div>
          </template>

          <template #body-cell-status="props">
            <q-td :props="props">
              <div class="status-cell">
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
                <!-- Fund shortfall rides alongside the membership status: a
                     member can be "ใช้งาน" and still owe the 50-baht minimum (not shown
                     once they have resigned or died). -->
                <q-badge
                  v-if="showsFundShortfall(props.row as CommitteeMember)"
                  color="red-1"
                  text-color="red-9"
                  class="q-px-sm q-py-xs"
                  rounded
                >
                  เงินสะสมไม่ครบ
                  <q-tooltip>
                    เงินสะสม {{ formatBaht(props.row.fundBalance?.totalContribution) }} บาท
                    จากขั้นต่ำ {{ FUND_MINIMUM_BAHT }} บาท
                  </q-tooltip>
                </q-badge>
              </div>
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

          <!-- Screening result, so a pending row says "ไม่ผ่านการตรวจสอบ" and
               "ยังไม่ตรวจสอบ" apart without opening the dialog. Same badge as
               the phone card (verificationMeta). -->
          <template #body-cell-verification="props">
            <q-td :props="props">
              <q-badge
                v-if="props.row.status === 'pending'"
                :color="verificationMeta(props.row as CommitteeMember).color"
                :text-color="verificationMeta(props.row as CommitteeMember).textColor"
                class="q-px-sm q-py-xs"
                rounded
              >
                {{ verificationMeta(props.row as CommitteeMember).label }}
              </q-badge>
              <span v-else>-</span>
            </q-td>
          </template>

          <!-- Name cell carries the profile photo: the row is how the committee
               recognises a member, and the photo does that faster than the code. -->
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
                  v-if="canResetPassword(props.row)"
                  flat
                  dense
                  round
                  size="sm"
                  icon="lock_reset"
                  color="orange-9"
                  @click="openPassword(props.row as CommitteeMember)"
                >
                  <q-tooltip>เปลี่ยนรหัสผ่านเข้าสู่ระบบ</q-tooltip>
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
                  :to="`/committee/members/${props.row.id}/deceased`"
                >
                  <q-tooltip>แจ้งเสียชีวิตและหักเงินสะสม 50 บาทจากสมาชิกใช้งานทุกคน</q-tooltip>
                </q-btn>
              </div>
            </q-td>
          </template>

          <template #no-data>
            <div class="full-width empty-state">
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
                รหัส {{ detail.data.memberCode }} · สมัคร
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
                <!-- Optional fields are dropped when empty instead of showing a
                     row of dashes - on a phone every row costs a line. -->
                <dl class="detail-list">
                  <div>
                    <dt>บัตรประชาชน</dt>
                    <dd>{{ detail.data.citizenId }}</dd>
                  </div>
                  <div>
                    <dt>วันเกิด</dt>
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
                  <div v-if="detail.data.occupation">
                    <dt>อาชีพ</dt>
                    <dd>{{ detail.data.occupation }}</dd>
                  </div>
                  <div v-if="detail.data.approvedDate">
                    <dt>วันอนุมัติ</dt>
                    <dd>{{ formatThaiDate(detail.data.approvedDate) }}</dd>
                  </div>
                  <div v-if="detail.data.remark">
                    <dt>หมายเหตุ</dt>
                    <dd>{{ detail.data.remark }}</dd>
                  </div>
                </dl>
              </section>

              <!-- Address, guarantor and login each read as one line: a label
                   column for "ตำบล", "อำเภอ", "จังหวัด" ate a third of the
                   dialog on a phone and said nothing the value doesn't. -->
              <section class="detail-section">
                <div class="detail-section-title"><q-icon name="home" /> ที่อยู่</div>
                <div class="detail-line">{{ detailAddress }}</div>

                <div class="detail-section-title q-mt-md">
                  <q-icon name="handshake" /> ผู้แนะนำ / ผู้ค้ำประกัน
                </div>
                <template v-if="detailGuarantor">
                  <div class="detail-line">{{ detailGuarantor.name }}</div>
                  <div v-if="detailGuarantor.meta" class="detail-note">
                    {{ detailGuarantor.meta }}
                  </div>
                </template>
                <div v-else class="detail-note">ไม่มีข้อมูล</div>

                <div class="detail-section-title q-mt-md">
                  <q-icon name="key" /> บัญชีเข้าสู่ระบบ
                </div>
                <div v-if="detail.data.userAccount" class="detail-line">
                  {{ detail.data.userAccount.username }}
                  <q-badge
                    :color="detail.data.userAccount.status === 'active' ? 'green-2' : 'red-2'"
                    :text-color="
                      detail.data.userAccount.status === 'active' ? 'positive' : 'red-9'
                    "
                    class="q-ml-xs q-px-sm"
                    rounded
                  >
                    {{ detail.data.userAccount.status === 'active' ? 'ใช้งานได้' : 'ถูกระงับ' }}
                  </q-badge>
                </div>
                <div v-else class="detail-note">ยังไม่มีบัญชี</div>
              </section>
            </div>

            <!-- Fund-claim eligibility (active members only) -->
            <section v-if="detail.data.benefitEligibility" class="detail-section q-mt-md">
              <div class="detail-section-title">
                <q-icon name="savings" /> สิทธิ์ขอรับเงินกองทุน
                <q-badge
                  :color="detail.data.benefitEligibility.eligible ? 'green-2' : 'amber-2'"
                  :text-color="detail.data.benefitEligibility.eligible ? 'positive' : 'orange-10'"
                  class="q-ml-sm q-px-sm"
                  rounded
                >
                  {{ detail.data.benefitEligibility.eligible ? 'ครบเงื่อนไข' : 'ยังไม่ครบ' }}
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
                </q-checkbox>

                <q-checkbox v-model="verifyForm.addressVerified" class="verify-check">
                  <div class="verify-title">ตรวจสอบที่อยู่แล้ว</div>
                </q-checkbox>
                <q-checkbox v-model="verifyForm.guarantorVerified" class="verify-check">
                  <div class="verify-title">ตรวจสอบผู้แนะนำ/ผู้ค้ำประกันแล้ว</div>
                </q-checkbox>

                <q-option-group
                  v-model="verifyForm.result"
                  inline
                  :options="[
                    { label: 'ผ่านการตรวจสอบ', value: 'passed', disable: !detailChecksOk },
                    { label: 'ไม่ผ่านการตรวจสอบ', value: 'failed' },
                  ]"
                />
                <q-input v-model="verifyForm.note" outlined dense autogrow label="หมายเหตุ" />

                <div class="verify-actions">
                  <q-btn
                    unelevated
                    no-caps
                    color="primary"
                    icon="fact_check"
                    label="บันทึกผล"
                    :loading="verifyForm.busy"
                    @click="submitVerification"
                  />
                  <q-btn
                    unelevated
                    no-caps
                    color="positive"
                    icon="how_to_reg"
                    label="อนุมัติ"
                    :disable="latestDetailVerification?.result !== 'passed'"
                    @click="openAction('approve', detail.data)"
                  >
                    <q-tooltip v-if="latestDetailVerification?.result !== 'passed'">
                      ต้องมีผลตรวจสอบ "ผ่าน" ก่อน
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
                    <div class="verify-caption">{{ verificationChecksLabel(check) }}</div>
                    <div v-if="check.note" class="history-note">
                      <span class="history-note-label">หมายเหตุ</span>{{ check.note }}
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
                  label="ไฟล์ PDF/รูป ไม่เกิน 5MB"
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
                label="หมายเหตุ"
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
                      {{ documentTypeLabel(document.documentType) }} ·
                      {{ formatFileSize(document.fileSize) }}
                    </div>
                    <div v-if="document.note" class="history-note">
                      <span class="history-note-label">หมายเหตุ</span>{{ document.note }}
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
              <div v-else class="verify-caption q-mt-sm">ไม่มีเอกสาร</div>
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
                    <div v-if="entry.reason" class="history-note">
                      <span class="history-note-label">เหตุผล</span>{{ entry.reason }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="verify-caption">ไม่มีประวัติ</div>
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
              label="แก้ไข"
              class="detail-action detail-action--edit"
              @click="openEdit(detail.data)"
            />
            <q-btn
              v-if="canResetPassword(detail.data)"
              flat
              no-caps
              icon="lock_reset"
              color="orange-9"
              label="เปลี่ยนรหัสผ่าน"
              class="detail-action detail-action--password"
              @click="openPassword(detail.data)"
            />
            <q-space v-if="!isPhone" />
            <q-btn
              v-if="canManageMember(detail.data)"
              flat
              no-caps
              icon="person_off"
              color="red-7"
              label="ยกเลิกสมาชิก"
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
              :to="`/committee/members/${detail.data.id}/deceased`"
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
            {{ documentTypeLabel(documentToDelete.documentType) }} ·
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
            :options="genderOptions"
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
          <!-- Locked to the committee's own village: moving a member to
               another moo is rejected by the backend anyway. -->
          <q-input
            v-model="editForm.address.moo"
            outlined
            dense
            disable
            label="หมู่ที่ (หมู่บ้านที่รับผิดชอบ)"
            class="span-3"
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

    <!-- ============ Reset login password ============ -->
    <MidDialog
      v-model="passwordOpen"
      size="sm"
      icon="lock_reset"
      badge="เปลี่ยนรหัสผ่าน"
      title="ตั้งรหัสผ่านใหม่"
      tone="warning"
      :persistent="passwordBusy"
    >
      <template v-if="passwordMember">
        <div class="dialog-summary dialog-summary--warning">
          <q-icon name="person" />
          <div class="history-copy">
            <div class="history-main">{{ memberFullName(passwordMember) }}</div>
            <div class="verify-caption">รหัสสมาชิก {{ passwordMember.memberCode }}</div>
            <div class="verify-caption">
              ชื่อผู้ใช้เข้าสู่ระบบ: {{ passwordMember.userAccount?.username }}
            </div>
          </div>
        </div>

        <q-form ref="passwordFormRef" greedy class="password-form" @submit.prevent="submitPassword">
          <q-input
            v-model="passwordForm.newPassword"
            outlined
            dense
            label="รหัสผ่านใหม่ *"
            autocomplete="new-password"
            :type="passwordVisible ? 'text' : 'password'"
            :rules="[
              (v) => !!v || 'กรุณากรอกรหัสผ่านใหม่',
              (v) => v.length >= 8 || 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
            ]"
          >
            <template #append>
              <q-btn
                flat
                dense
                round
                :icon="passwordVisible ? 'visibility' : 'visibility_off'"
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </q-input>
          <q-input
            v-model="passwordForm.confirmPassword"
            outlined
            dense
            label="ยืนยันรหัสผ่านใหม่ *"
            autocomplete="new-password"
            :type="passwordVisible ? 'text' : 'password'"
            :rules="[
              (v) => !!v || 'กรุณายืนยันรหัสผ่านใหม่',
              (v) => v === passwordForm.newPassword || 'รหัสผ่านไม่ตรงกัน',
            ]"
          />
          <q-btn
            flat
            dense
            no-caps
            icon="badge"
            color="orange-9"
            label="ใช้เลขบัตรประชาชนเป็นรหัสผ่าน"
            class="password-citizen-btn"
            @click="useCitizenIdPassword"
          />

          <div class="dialog-actions">
            <MidButton
              variant="secondary"
              label="ยกเลิก"
              :disable="passwordBusy"
              @click="passwordOpen = false"
            />
            <MidButton
              type="submit"
              icon="lock_reset"
              label="บันทึกรหัสผ่าน"
              :loading="passwordBusy"
            />
          </div>
        </q-form>
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
import { useRoute, useRouter } from 'vue-router';
import { useQuasar, type QForm } from 'quasar';
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
import { useAuthStore } from 'src/stores/authStore';
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
  FUND_BELOW_MINIMUM_FILTER,
  FUND_MINIMUM_BAHT,
  FUND_STATUS_BELOW_MINIMUM,
  MEMBER_LIST_STATUS_OPTIONS,
  formatBaht,
  formatThaiDate,
  formatThaiDateTime,
  showsFundShortfall,
  memberFullName,
  memberStatusColor,
  memberStatusLabel,
} from '../municipality/format';

const $q = useQuasar();
const route = useRoute();
const router = useRouter();
const store = useCommitteeStore();
const authStore = useAuthStore();

const summary = computed(() => store.summary);
const members = computed(() => store.members);
const detail = computed(() => store.memberDetail);
// The village this committee was assigned by the admin - everything on this
// page is already restricted to it server-side.
const villageLabel = computed(() => authStore.myVillageLabel);
const villageMoo = computed(() => authStore.myVillageMoo);
const hasVillage = computed(() => authStore.myVillage !== null);

// --- List filters -------------------------------------------------------------

const search = ref('');
const status = ref<string | null>(null);
let filterTimer: number | undefined;

const statusOptions = MEMBER_LIST_STATUS_OPTIONS;

// The "เงินสะสมยังไม่ครบ" entry in that same select is not a member.status, so it
// travels to the backend as its own `fundStatus` query param instead.
const fundFilterSelected = computed(() => status.value === FUND_BELOW_MINIMUM_FILTER);

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
  applyFilters();
}

// Below `sm` the table switches to q-table's grid mode and renders the #item
// card instead of a row (same breakpoint as the rounds and sell-request lists).
const isPhone = computed(() => $q.screen.lt.sm);

const pagination = useRememberedPagination('committee-members', {
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
    field: (row: CommitteeMember) => memberAddressLabel(row),
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

// The eligibility badge for a pending member, shared by the table cell and the
// phone card so the two can't drift apart.
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
      label: `เงินสะสม ${fundCheck.amount.toLocaleString()} / ${fundCheck.required} บาท`,
    },
    {
      passed: membershipAgeCheck.passed,
      label: `อายุสมาชิก ${membershipAgeCheck.months} / ${membershipAgeCheck.required} เดือน`,
    },
    {
      passed: wasteSaleActivityCheck.passed,
      label: `ขายขยะ ${wasteSaleActivityCheck.activeMonths} / ${wasteSaleActivityCheck.required} เดือน (ใน ${wasteSaleActivityCheck.windowMonths} เดือนล่าสุด)`,
    },
  ];
}

// Edit / cancel-membership / mark-deceased are all gated by the same rule:
// a member already in a terminal status (resigned or deceased) can't be
// managed further.
function canManageMember(member: CommitteeMember): boolean {
  return member.status !== 'resigned' && member.status !== 'deceased';
}

// Only members that have a login account (every member registered through the
// app does) - same terminal-status rule as the other actions.
function canResetPassword(member: CommitteeMember): boolean {
  return canManageMember(member) && member.userAccount !== null;
}

// Same choices as the add-member form (CommitteeAddMemberPage).
const genderOptions = [
  { label: 'ชาย', value: 'male' },
  { label: 'หญิง', value: 'female' },
  { label: 'ไม่ระบุ', value: 'unspecified' },
];

function genderLabel(gender: string | null): string {
  return genderOptions.find((option) => option.value === gender)?.label ?? (gender || '-');
}

// Without a village the backend refuses every committee endpoint, so skip the
// calls entirely - otherwise the page stacks a load-error banner on top of the
// "no village assigned" warning that already explains the situation.
function loadSummary() {
  if (!hasVillage.value) return;
  void store.fetchSummary();
}

async function loadMembers() {
  if (!hasVillage.value) return;

  const applied = await store.fetchMembers({
    page: pagination.value.page,
    pageSize: pagination.value.rowsPerPage,
    search: search.value.trim() || undefined,
    status: fundFilterSelected.value ? undefined : (status.value ?? undefined),
    fundStatus: fundFilterSelected.value ? FUND_STATUS_BELOW_MINIMUM : undefined,
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

// "171 หมู่ 1 ต.สามงามท่าโบสถ์ อ.หันคา จ.ชัยนาท 17160" - the address as it is
// written on an envelope, instead of six label/value rows.
const detailAddress = computed(() => {
  const household = detail.value.data?.household;
  if (!household) return '-';
  const parts = [
    household.houseNo,
    household.moo ? `หมู่ ${household.moo}` : null,
    household.subdistrict ? `ต.${household.subdistrict}` : null,
    household.district ? `อ.${household.district}` : null,
    household.province ? `จ.${household.province}` : null,
    household.postcode,
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : '-';
});

// Name on its own line, relationship and phone as one quiet line under it.
const detailGuarantor = computed(() => {
  const guarantor = detail.value.data?.guarantors[0];
  if (!guarantor) return null;
  return {
    name: guarantor.guarantorName,
    meta: [guarantor.relationship, guarantor.guarantorPhone].filter(Boolean).join(' · '),
  };
});

// "58 ปี · อายุ ✓ ที่อยู่ ✓ ผู้แนะนำ ✗" - the three checks as marks, not a sentence.
function verificationChecksLabel(check: CommitteeVerification): string {
  const mark = (done: boolean) => (done ? '✓' : '✗');
  return `${check.ageYears} ปี · อายุ ${mark(check.ageEligible)} ที่อยู่ ${mark(
    check.addressVerified,
  )} ผู้แนะนำ ${mark(check.guarantorVerified)}`;
}

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

function openDetailById(memberId: number) {
  detailMemberId.value = memberId;
  verifyForm.ageVerified = false;
  verifyForm.addressVerified = false;
  verifyForm.guarantorVerified = false;
  verifyForm.result = 'failed';
  verifyForm.note = '';
  documentForm.documentType = 'citizen_id';
  documentForm.file = null;
  documentForm.note = '';
  detailOpen.value = true;
  void store.fetchMemberDetail(memberId);
}

function openDetail(member: CommitteeMember) {
  openDetailById(member.id);
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
  editForm.address.moo = member.household?.moo ?? villageMoo.value ?? '';
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

// --- Reset login password -----------------------------------------------------

const passwordOpen = ref(false);
const passwordBusy = ref(false);
const passwordVisible = ref(false);
const passwordMember = ref<CommitteeMember | CommitteeMemberDetail | null>(null);
const passwordFormRef = ref<QForm | null>(null);
const passwordForm = reactive({ newPassword: '', confirmPassword: '' });

function openPassword(member: CommitteeMember | CommitteeMemberDetail) {
  passwordMember.value = member;
  passwordForm.newPassword = '';
  passwordForm.confirmPassword = '';
  passwordVisible.value = false;
  passwordOpen.value = true;
}

// The initial password a desk-registered member gets when none is chosen
// (backend committeeService.createMember) - the easy one to hand back.
function useCitizenIdPassword() {
  if (!passwordMember.value) return;
  passwordForm.newPassword = passwordMember.value.citizenId;
  passwordForm.confirmPassword = passwordMember.value.citizenId;
  passwordVisible.value = true;
}

async function submitPassword() {
  if (!passwordMember.value || passwordBusy.value) return;
  const valid = await passwordFormRef.value?.validate();
  if (!valid) return;

  passwordBusy.value = true;
  try {
    await store.resetMemberPassword(passwordMember.value.id, passwordForm.newPassword);
    midNotify({ type: 'success', message: 'เปลี่ยนรหัสผ่านสมาชิกเรียบร้อย' });
    passwordOpen.value = false;
  } catch (error) {
    midNotify({ type: 'error', message: apiErrorMessage(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ') });
  } finally {
    passwordBusy.value = false;
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

  // ?member=<id> - arriving from the "เพิ่มสมาชิกสำเร็จ" dialog: open that
  // member straight away, then drop the query so a reload/back doesn't reopen it.
  const requested = Number(route.query.member);
  if (Number.isInteger(requested) && requested > 0) {
    openDetailById(requested);
    void router.replace({ path: route.path });
  }
});

// The session may still be in flight on first paint (or an admin may assign a
// village mid-session) - load as soon as one shows up.
watch(hasVillage, (assigned, wasAssigned) => {
  if (assigned && !wasAssigned) {
    loadSummary();
    void loadMembers();
  }
});

onBeforeUnmount(() => {
  if (filterTimer) window.clearTimeout(filterTimer);
});
</script>

<style lang="scss" scoped>
@use '../municipality/theme' as *;
@use '../../components/MID/mid.variables' as mid;

// The theme's `flex: 1` gives the title block a zero basis, so on a phone it shrank
// to one word per line beside the button. A 200px floor keeps it beside the icon
// and makes the button wrap onto its own line instead.
.hero-copy {
  flex: 1 1 200px;
}

// Keeps "หมู่ 1 – บ้านหนองน้ำ" in one piece: when it doesn't fit after the
// sentence it moves to the next line whole, instead of leaving "หมู่ 1 –" behind.
.hero-village {
  display: inline-block;
}

.hero-add-btn {
  color: #075c38;
  background: #ffffff;
  border-radius: 12px;
  font-weight: 900;
  min-height: 44px;
  padding: 0 18px;
}

// --- Phone: one card per member (q-table grid mode) --------------------------

.member-card-wrap {
  padding: 6px 16px;
}

.member-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e3ece2;
  border-radius: 14px;
  cursor: pointer;
}

.member-card-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-card-avatar {
  color: #0d7a44;
  background: #eaf6ec;
  border: 1px solid #dcefe1;
  font-size: 19px;
  font-weight: 800;
}

.member-card-title {
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
}

.member-card-name {
  color: #18231e;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.3;
}

.member-card-sub {
  margin-top: 2px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 600;
}

.member-card-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.member-card-rows {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding-top: 10px;
  border-top: 1px dashed #e3ece2;
}

.member-card-rows > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 24px;
}

.member-card-rows dt {
  flex-shrink: 0;
  color: #7f8f85;
  font-size: 13px;
  font-weight: 600;
}

.member-card-rows dd {
  margin: 0;
  color: #18231e;
  font-size: 13.5px;
  font-weight: 700;
  text-align: right;
  overflow-wrap: anywhere;
}

.member-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e3ece2;
}

// Each button takes at least half the row, so they pair up two per line and a
// lone one still reads as a button rather than a stray chip.
.member-card-btn {
  flex: 1 1 calc(50% - 8px);
  min-height: 38px;
  border-radius: 10px;
  font-weight: 700;
}

.member-card-btn.is-detail {
  color: #0d7a44;
  background: #eaf6ec;
}

.member-card-btn.is-edit {
  color: #1565c0;
  background: #e8f1fc;
}

.member-card-btn.is-approve {
  color: #0d7a44;
  background: #dff2e4;
}

.member-card-btn.is-cancel {
  color: #b23a3a;
  background: #fdeaea;
}

.member-card-btn.is-deceased {
  color: #5e35b1;
  background: #efe9fa;
}

.member-card-btn.is-password {
  color: #b45309;
  background: #fdf1e3;
}

.password-form {
  display: grid;
  gap: 12px;
  margin-top: 16px;
}

.password-citizen-btn {
  justify-self: start;
  font-weight: 700;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 18px 28px;
}

// two badges stack instead of stretching the status column
.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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

// Dropping the verification column freed a track, so the remaining cells get
// room to breathe and the name column can carry a 38px photo without the text
// wrapping under it.
.member-table :deep(thead th),
.member-table :deep(tbody td) {
  padding: 12px 18px;
}

.member-table :deep(tbody td) {
  height: 62px;
}

.member-table :deep(th:nth-child(2)),
.member-table :deep(td:nth-child(2)) {
  min-width: 250px;
}

.member-table :deep(th:nth-child(3)),
.member-table :deep(td:nth-child(3)),
.member-table :deep(th:nth-child(5)),
.member-table :deep(td:nth-child(5)) {
  min-width: 170px;
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

.detail-line {
  color: #1c2b23;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.detail-note {
  margin-top: 2px;
  color: #7f8f85;
  font-size: 12.5px;
  font-weight: 700;
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

.history-date {
  margin-left: 6px;
  color: #98a19d;
  font-size: 12px;
  font-weight: 700;
}

// A note someone typed in - kept on its own line, behind its own label, so it
// never reads as part of the check/upload summary above it.
.history-note {
  margin-top: 4px;
  padding-left: 8px;
  border-left: 2px solid #d9e6dd;
  color: #5d6b63;
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.history-note-label {
  margin-right: 6px;
  color: #8d9a93;
  font-size: 12px;
  font-weight: 800;
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
// list, the detail dialog and the edit dialog all switch together. It sits after
// the base rules on purpose: a media query adds no specificity, so a rule placed
// above the one it overrides never wins.
@media (max-width: 599px) {
  .hero-add-btn {
    width: 100%;
  }

  .panel-card--flush .panel-head {
    padding: 20px 16px 0;
  }

  // Lines the search row up with the cards' 16px edge.
  .filter-row {
    padding: 12px 16px;
  }

  // Edit form: one field per row.
  .span-3,
  .span-4,
  .span-6 {
    grid-column: span 12;
  }

  // --- The detail dialog gets its width back ---------------------------------
  // The card keeps only an 8px gutter, the section padding and the label column
  // shrink, and the footer buttons become a 2x2 grid of tinted tiles.
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

  // Four text buttons squeezed into one row wrapped "เปลี่ยนรหัสผ่าน" onto three
  // lines. Two per row, each a rounded tile in its own soft tint (MidButton's
  // radius and weight, MID colours), keeps every label on one line and the
  // actions within thumb reach.
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

  // An odd tile out (when only some actions apply) takes the full row.
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

  .detail-action--password {
    background: rgba(mid.$mid-warning, 0.14);
  }

  .detail-action--cancel {
    background: rgba(mid.$mid-danger, 0.09);
  }

  .detail-action--deceased {
    background: mid.$mid-purple-soft;
  }
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

// Inside the orange (tone="warning") password dialog.
.dialog-summary--warning {
  border-color: #fed7aa;
  background: #fff7ed;

  .q-icon {
    color: #ea580c;
  }
}

.document-delete-btn {
  align-self: center;
  flex-shrink: 0;
}

// Form dialog footers (edit / password). They sit inside their q-form so the
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
