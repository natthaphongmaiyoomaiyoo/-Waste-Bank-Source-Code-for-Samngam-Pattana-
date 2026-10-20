<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <!-- Page header: the chart's period switch. -->
      <header class="dash-topbar">
        <nav class="dash-tabs" aria-label="ช่วงเวลาของกราฟ">
          <button
            v-for="option in rangeOptions"
            :key="option.value"
            type="button"
            :class="['dash-tab', { 'is-active': range === option.value }]"
            @click="setRange(option.value)"
          >
            {{ option.label }}
          </button>
        </nav>
      </header>

      <!-- The side menu as tiles, one tap each - same shape as the committee and
           member home pages' buttons. Outside the data block on purpose, so it is
           usable while the dashboard is still loading. -->
      <nav class="menu-actions" aria-label="เมนูเจ้าหน้าที่เทศบาล">
        <q-btn
          v-for="item in menuActions"
          :key="item.to"
          unelevated
          no-caps
          stack
          :to="item.to"
          :icon="item.icon"
          :label="item.label"
          :class="['menu-action', { 'is-primary': item.primary }]"
        />
      </nav>

      <q-banner v-if="report.error" rounded class="bg-red-1 text-red-9 error-banner">
        {{ report.error }}
        <template #action>
          <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="load" />
        </template>
      </q-banner>

      <div v-else-if="report.loading && !report.data" class="loading-wrap">
        <q-spinner-dots size="48px" color="positive" />
      </div>

      <template v-else-if="report.data">
        <!-- Headline: the members' savings, then the four all-time totals. -->
        <section class="dash-overview">
          <div class="dash-headline">
            <div class="headline-main">
              <div class="headline-label">เงินสะสมของสมาชิก</div>
              <div class="headline-value">
                {{ formatBaht(fundContributionBalance) }}
                <span>บาท</span>
              </div>
            </div>
          </div>

          <div class="dash-stats">
            <article v-for="stat in statStrip" :key="stat.label" class="dash-stat">
              <div class="stat-head">
                <q-icon :name="stat.icon" :class="stat.iconClass" />
                {{ stat.label }}
              </div>
              <div class="stat-value">
                {{ stat.value }}
                <span>{{ stat.unit }}</span>
              </div>
            </article>
          </div>
        </section>

        <!-- Time series + weight ranking, the two panels the officer reads first. -->
        <section class="dash-grid">
          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">ปริมาณขยะและยอดขาย{{ activeRange.title }}</div>
                <div class="panel-caption">{{ activeRange.caption }}</div>
              </div>
            </div>

            <div v-if="chartLoading" class="loading-wrap">
              <q-spinner-dots size="36px" color="positive" />
            </div>
            <apexchart
              v-else-if="chartHasData"
              type="line"
              height="320"
              :options="chartOptions"
              :series="chartSeries"
            />
            <div v-else class="empty-state">
              <q-icon name="show_chart" size="32px" />
              ยังไม่มีข้อมูลการขายใน{{ activeRange.title }}
            </div>
          </q-card>

          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">ประเภทขยะยอดฮิต 5 อันดับ</div>
              </div>
            </div>

            <div v-if="topWasteRows.length" class="waste-rank">
              <div v-for="row in topWasteRows" :key="row.wasteTypeId" class="waste-row">
                <div class="waste-line">
                  <span class="waste-no">{{ row.rank }}</span>
                  <span class="waste-name">{{ row.wasteName }}</span>
                  <span class="waste-figure">
                    {{ formatQuantity(row.quantity) }} {{ row.unit }} · {{ row.percentLabel }}
                  </span>
                </div>
                <div class="waste-track">
                  <div class="waste-fill" :style="{ width: row.barWidth }"></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state">
              <q-icon name="inbox" size="32px" />
              ยังไม่มีข้อมูลการขายขยะ
            </div>

            <div v-if="topWasteRows.length" class="waste-foot">
              <button type="button" class="panel-link panel-link--button" @click="allWasteOpen = true">
                ดูทั้งหมด ({{ allWasteRows.length }} ประเภท)
                <q-icon name="chevron_right" />
              </button>
            </div>
          </q-card>

          <!-- Every waste type ever sold, same rows as the card plus the baht. -->
          <MidDialog
            v-model="allWasteOpen"
            size="lg"
            title="ประเภทขยะที่มีการขาย"
          >
            <div class="waste-rank waste-rank--all">
              <div v-for="row in allWasteRows" :key="row.wasteTypeId" class="waste-row">
                <div class="waste-line">
                  <span class="waste-no">{{ row.rank }}</span>
                  <span class="waste-name">{{ row.wasteName }}</span>
                  <span class="waste-figure">
                    {{ formatQuantity(row.quantity) }} {{ row.unit }} · {{ row.percentLabel }}
                  </span>
                </div>
                <div class="waste-track">
                  <div class="waste-fill" :style="{ width: row.barWidth }"></div>
                </div>
                <div class="waste-amount">ยอดขาย {{ formatBaht(row.amount) }} บาท</div>
              </div>
            </div>
          </MidDialog>
        </section>

        <section class="dashboard-grid co2-dashboard-grid">
          <q-card flat class="panel-card co2-panel">
            <div class="panel-head">
              <div>
                <div class="panel-title">Estimated CO2 Credit</div>
              </div>
              <div class="co2-total">
                {{ formatCarbon(report.data.co2Credit.estimatedKgCo2e) }}
                <span>kgCO2e</span>
              </div>
            </div>

            <div class="co2-metrics">
              <div class="co2-metric">
                <span>ขยะที่ขายออกแล้ว</span>
                <strong>{{ formatQuantity(report.data.co2Credit.totalWasteSold) }} กก.</strong>
              </div>
              <div class="co2-metric">
                <span>เทียบเป็นตันคาร์บอน</span>
                <strong>{{ formatCarbon(report.data.co2Credit.estimatedTCo2e) }} tCO2e</strong>
              </div>
              <div class="co2-metric">
                <span>ค่า factor เริ่มต้น</span>
                <strong>{{ formatCarbon(report.data.co2Credit.defaultEmissionReductionFactor) }} kgCO2e/กก.</strong>
              </div>
            </div>

            <div v-if="chartLoading" class="loading-wrap">
              <q-spinner-dots size="36px" color="positive" />
            </div>
            <apexchart
              v-else-if="co2ChartHasData"
              type="bar"
              height="320"
              :options="co2ChartOptions"
              :series="co2ChartSeries"
            />
            <div v-else class="empty-state">
              <q-icon name="co2" size="32px" />
              ยังไม่มีข้อมูลขยะที่ขายออกแล้วใน{{ activeRange.title }}
            </div>

            <div v-if="co2Excluded.length" class="co2-excluded-note">
              <q-icon name="info_outline" />
              ไม่นำมาคำนวณเพราะหน่วยไม่ใช่กิโลกรัม:
              {{ co2Excluded.map((row) => `${row.wasteName} (${formatQuantity(row.quantity)} ${row.unit})`).join(', ') }}
            </div>
          </q-card>
        </section>

        <!-- Per-village comparison, as one bubble per หมู่บ้าน: weight on x, the
             money that weight fetched on y, CO2 credit as the bubble's area. One
             frame instead of three bar charts, so "sells a lot / earns a lot /
             saves a lot of carbon" is a single position on the plot rather than
             three slots the eye has to re-find. All-time, and deliberately
             outside the period switch above - fund balances have no history. -->
        <section class="village-section">
          <q-banner v-if="villageReport.error" rounded class="bg-red-1 text-red-9 error-banner">
            {{ villageReport.error }}
            <template #action>
              <q-btn flat no-caps color="red-9" label="ลองใหม่" @click="loadVillages" />
            </template>
          </q-banner>

          <div v-else-if="villageReport.loading && !villageReport.data" class="loading-wrap">
            <q-spinner-dots size="36px" color="positive" />
          </div>

          <q-card v-else-if="!villageRows.length" flat class="panel-card">
            <div class="empty-state">
              <q-icon name="holiday_village" size="32px" />
              ยังไม่มีข้อมูลรายหมู่บ้าน
            </div>
          </q-card>

          <template v-else>
            <!-- "หมู่บ้านนี้มีเงินสะสมกี่บาท" - the one question this section is
                 asked most, so it gets its own card above the sales comparison
                 instead of living as a column in the table below. Horizontal so
                 a หมู่บ้าน name reads straight. Same live snapshot as the rest of
                 the section - no period switch. -->
            <q-card flat class="panel-card village-fund-card">
              <div class="panel-head">
                <div>
                  <div class="panel-title">เงินสะสมรายหมู่บ้าน</div>
                </div>
                <div class="co2-total">
                  {{ formatBaht(villageFundTotal) }}
                  <span>บาท รวมทุกหมู่บ้าน</span>
                </div>
              </div>

              <apexchart
                v-if="villageFundHasData"
                type="bar"
                :height="villageFundChartHeight"
                :options="villageFundOptions"
                :series="villageFundSeries"
              />
              <div v-else class="empty-state">
                <q-icon name="savings" size="32px" />
                ยังไม่มีเงินสะสมในหมู่บ้านใด
              </div>
            </q-card>

            <q-card flat class="panel-card village-bubble-card">
              <div class="panel-head">
                <div class="panel-title">การขายขยะรายหมู่บ้าน</div>
              </div>

              <apexchart
                v-if="villageBubbleHasData"
                type="bubble"
                :height="isPhone ? 380 : 600"
                :options="villageBubbleOptions"
                :series="villageBubbleSeries"
              />
              <div v-else class="empty-state">
                <q-icon name="bubble_chart" size="32px" />
                ยังไม่มีการขายขยะของหมู่บ้านให้วางลงบนกราฟ
              </div>
            </q-card>

            <!-- Table view: the exact figure behind every bubble, plus the
                 savings column the chart leaves out. Also the way out when two villages sell so little that
                 their bubbles land on top of each other near the origin. -->
            <q-card flat class="panel-card village-table-card">
              <div class="panel-head">
                <div class="panel-title">สรุปรายหมู่บ้าน</div>
              </div>

              <q-table
                flat
                dense
                hide-pagination
                row-key="label"
                class="muni-table village-table"
                :rows="villageRows"
                :columns="villageColumns"
                :rows-per-page-options="[0]"
              >
                <template #body="props">
                  <q-tr :props="props" class="village-row">
                    <q-td key="village" :props="props">
                      <div class="village-cell">
                        <div class="village-moo">
                          <span>หมู่</span>
                          <strong>{{ props.row.moo ?? '?' }}</strong>
                        </div>
                        <div class="village-name-wrap">
                          <div class="village-name">
                            {{ props.row.villageName ?? props.row.label }}
                          </div>
                          <div v-if="props.row.subdistrict" class="village-sub">
                            ต.{{ props.row.subdistrict }}
                          </div>
                        </div>
                      </div>
                    </q-td>
                    <q-td key="members" :props="props">
                      <span class="num">{{ props.row.memberCount.toLocaleString('th-TH') }}</span>
                      <span class="num-unit">คน</span>
                    </q-td>
                    <q-td key="quantity" :props="props">
                      <span class="num">{{ formatQuantity(props.row.totalQuantity) }}</span>
                    </q-td>
                    <q-td key="amount" :props="props">
                      <div class="num num-strong">{{ formatBaht(props.row.totalAmount) }}</div>
                      <!-- Share of the biggest village's sales, so the column scans
                           as a ranking without reading every number. -->
                      <div class="share-track">
                        <div class="share-fill" :style="{ width: `${villageSalesShare(props.row)}%` }"></div>
                      </div>
                    </q-td>
                    <q-td key="co2" :props="props">
                      <span class="num num-co2">{{ formatCarbon(props.row.co2Credit.estimatedKgCo2e) }}</span>
                    </q-td>
                    <q-td key="savings" :props="props">
                      <span :class="['num', props.row.fund.contributionBalance > 0 ? 'num-money' : 'num-zero']">
                        {{ formatBaht(props.row.fund.contributionBalance) }}
                      </span>
                    </q-td>
                  </q-tr>
                </template>

                <template #bottom-row>
                  <q-tr class="village-sum-row">
                    <q-td>
                      <div class="village-name">รวมทุกหมู่บ้าน</div>
                    </q-td>
                    <q-td class="text-right">
                      <span class="num">{{ (villageTotals?.memberCount ?? 0).toLocaleString('th-TH') }}</span>
                      <span class="num-unit">คน</span>
                    </q-td>
                    <q-td class="text-right num">{{ formatQuantity(villageTotals?.totalQuantity) }}</q-td>
                    <q-td class="text-right num">{{ formatBaht(villageTotals?.totalAmount) }}</q-td>
                    <q-td class="text-right num">{{ formatCarbon(villageTotals?.estimatedKgCo2e) }}</q-td>
                    <q-td class="text-right num num-money">{{ formatBaht(villageFundTotal) }}</q-td>
                  </q-tr>
                </template>
              </q-table>

              <!-- Phone: the same figures as one card per village - six columns
                   do not fit a phone without sideways scrolling. -->
              <div class="village-cards">
                <article v-for="row in villageRows" :key="row.label" class="village-card">
                  <div class="village-card-head">
                    <div class="village-cell">
                      <div class="village-moo">
                        <span>หมู่</span>
                        <strong>{{ row.moo ?? '?' }}</strong>
                      </div>
                      <div class="village-name-wrap">
                        <div class="village-name">{{ row.villageName ?? row.label }}</div>
                        <div v-if="row.subdistrict" class="village-sub">ต.{{ row.subdistrict }}</div>
                      </div>
                    </div>
                    <div class="village-card-members">
                      <span class="num">{{ row.memberCount.toLocaleString('th-TH') }}</span>
                      <span class="num-unit">คน</span>
                    </div>
                  </div>

                  <div class="village-card-grid">
                    <div class="village-metric">
                      <div class="village-metric-label">ยอดขาย (บาท)</div>
                      <div class="num num-strong">{{ formatBaht(row.totalAmount) }}</div>
                      <div class="share-track share-track--card">
                        <div class="share-fill" :style="{ width: `${villageSalesShare(row)}%` }"></div>
                      </div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">ปริมาณขยะ (กก.)</div>
                      <div class="num">{{ formatQuantity(row.totalQuantity) }}</div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">CO2 credit (kgCO2e)</div>
                      <div class="num num-co2">{{ formatCarbon(row.co2Credit.estimatedKgCo2e) }}</div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">เงินสะสม (บาท)</div>
                      <div :class="['num', row.fund.contributionBalance > 0 ? 'num-money' : 'num-zero']">
                        {{ formatBaht(row.fund.contributionBalance) }}
                      </div>
                    </div>
                  </div>
                </article>

                <article class="village-card village-card--sum">
                  <div class="village-card-head">
                    <div class="village-name">รวมทุกหมู่บ้าน</div>
                    <div class="village-card-members">
                      <span class="num">{{ (villageTotals?.memberCount ?? 0).toLocaleString('th-TH') }}</span>
                      <span class="num-unit">คน</span>
                    </div>
                  </div>
                  <div class="village-card-grid">
                    <div class="village-metric">
                      <div class="village-metric-label">ยอดขาย (บาท)</div>
                      <div class="num num-strong">{{ formatBaht(villageTotals?.totalAmount) }}</div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">ปริมาณขยะ (กก.)</div>
                      <div class="num">{{ formatQuantity(villageTotals?.totalQuantity) }}</div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">CO2 credit (kgCO2e)</div>
                      <div class="num">{{ formatCarbon(villageTotals?.estimatedKgCo2e) }}</div>
                    </div>
                    <div class="village-metric">
                      <div class="village-metric-label">เงินสะสม (บาท)</div>
                      <div class="num num-money">{{ formatBaht(villageFundTotal) }}</div>
                    </div>
                  </div>
                </article>
              </div>

              <div v-if="villageExcludedNote" class="co2-excluded-note">
                <q-icon name="info_outline" />
                CO2 credit คิดจากขยะที่ขายเป็นกิโลกรัมเท่านั้น ไม่รวม {{ villageExcludedNote }}
              </div>
            </q-card>
          </template>
        </section>

        <section class="dashboard-grid">
          <q-card flat class="panel-card">
            <div class="panel-head">
              <div>
                <div class="panel-title">สถานะสมาชิก</div>
                <div class="panel-caption">
                  {{ memberHeadline.total }} คน · {{ memberSource.householdCount }} ครัวเรือน
                </div>
              </div>
              <div class="panel-head-actions">
                <q-select
                  v-model="memberVillage"
                  dense
                  outlined
                  emit-value
                  map-options
                  class="village-select"
                  :options="memberVillageOptions"
                  :disable="villageReport.loading && villageRows.length === 0"
                  aria-label="เลือกหมู่บ้านที่จะแสดงในกราฟ"
                />
                <router-link to="/municipality/members" class="panel-link panel-link--pill">
                  ดูรายชื่อ
                  <q-icon name="chevron_right" />
                </router-link>
              </div>
            </div>

            <div class="member-split">
              <div class="member-donut">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle class="donut-track" cx="60" cy="60" r="52" />
                  <g transform="rotate(-90 60 60)">
                    <circle
                      v-for="seg in memberDonutSegments"
                      :key="seg.status"
                      class="donut-arc"
                      cx="60"
                      cy="60"
                      r="52"
                      :stroke="seg.color"
                      :stroke-dasharray="seg.dash"
                      :stroke-dashoffset="seg.offset"
                    />
                  </g>
                </svg>
                <div class="donut-center">
                  <strong>{{ memberHeadline.percentLabel }}</strong>
                  <span>ยังใช้งาน</span>
                  <small>{{ memberHeadline.active }} จาก {{ memberHeadline.total }} คน</small>
                </div>
              </div>

              <ul class="member-rows">
                <li
                  v-for="row in memberStatusRows"
                  :key="row.status"
                  :class="['member-row', { 'is-lead': row.status === 'active' }]"
                >
                  <span class="member-tick" :style="{ background: row.color }"></span>
                  <span class="member-name">{{ row.label }}</span>
                  <span class="member-count">{{ row.count }}</span>
                  <span class="member-percent">{{ row.percentLabel }}</span>
                  <q-tooltip>{{ row.label }} {{ row.count }} คน ({{ row.percentLabel }})</q-tooltip>
                </li>
              </ul>
            </div>

            <div class="member-foot">
              <div class="member-facts">
                <span class="member-fact">
                  สมัครใหม่เดือนนี้
                  <strong>{{ memberSource.newThisMonth }} คน</strong>
                </span>
                <span class="member-fact">
                  ครัวเรือน
                  <strong>{{ memberSource.householdCount }}</strong>
                </span>
              </div>
              <span v-if="memberHeadline.pending > 0" class="member-alert">
                <q-icon name="pending_actions" />
                มี {{ memberHeadline.pending }} รายรอตรวจสอบ
              </span>
            </div>
          </q-card>

          <q-card flat class="panel-card">
            <div class="panel-head">
              <div class="panel-title">กองทุนฌาปนกิจสงเคราะห์</div>
              <router-link to="/municipality/fund" class="panel-link">
                ดูรายการ
                <q-icon name="chevron_right" />
              </router-link>
            </div>

            <!-- The answer first (what is left), then the two movements that made
                 it: money in − funeral payouts = balance. -->
            <div class="fund-balance">
              <div class="fund-balance-icon">
                <q-icon name="savings" />
              </div>
              <div class="fund-balance-copy">
                <div class="fund-balance-label">เงินสะสมคงเหลือ</div>
                <div class="fund-balance-value">
                  {{ formatBaht(fundFlow.balance) }}
                  <span>บาท</span>
                </div>
              </div>
            </div>

            <div class="fund-flow-grid">
              <div class="fund-flow fund-flow--in">
                <div class="fund-flow-head">
                  <span class="fund-flow-icon"><q-icon name="south_west" /></span>
                  เงินเข้า
                </div>
                <div class="fund-flow-value">+{{ formatBaht(fundFlow.totalIn) }}</div>
                <div class="fund-flow-note">บาท</div>
              </div>
              <div class="fund-flow fund-flow--out">
                <div class="fund-flow-head">
                  <span class="fund-flow-icon"><q-icon name="north_east" /></span>
                  จ่ายฌาปนกิจ
                </div>
                <div class="fund-flow-value">−{{ formatBaht(fundFlow.welfareOut) }}</div>
                <div class="fund-flow-note">บาท</div>
              </div>
            </div>

            <!-- Where the money in came from - the two parts of "เงินเข้า" above,
                 not extra money on top of it. -->
            <div class="fund-mix">
              <div class="fund-mix-label">ที่มาของเงินเข้า</div>
              <div class="fund-mix-bar">
                <div
                  class="fund-mix-seg fund-mix-seg--contribution"
                  :style="{ width: `${fundFlow.contributionShare}%` }"
                ></div>
                <div
                  class="fund-mix-seg fund-mix-seg--deposit"
                  :style="{ width: `${fundFlow.depositShare}%` }"
                ></div>
              </div>
              <div class="fund-mix-legend">
                <div class="fund-mix-item">
                  <i class="fund-mix-dot fund-mix-dot--contribution"></i>
                  <span class="fund-mix-name">เติมให้ครบขั้นต่ำ</span>
                  <strong>{{ formatBaht(fundFlow.contributionIn) }}</strong>
                </div>
                <div class="fund-mix-item">
                  <i class="fund-mix-dot fund-mix-dot--deposit"></i>
                  <span class="fund-mix-name">สมาชิกเก็บเพิ่ม</span>
                  <strong>{{ formatBaht(fundFlow.depositIn) }}</strong>
                </div>
              </div>
            </div>
          </q-card>
        </section>
      </template>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useQuasar } from 'quasar';
import apexchart from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { MidDialog } from 'components/MID';
import { useMunicipalityStore } from 'src/stores/municipalityStore';
import type { Co2MonthlyPoint, VillageSummaryRow } from 'src/stores/municipalityStore';
import {
  formatBaht,
  formatCarbon,
  formatQuantity,
  formatMonthKey,
  memberStatusLabel,
  memberStatusRank,
  memberStatusTone,
  THAI_MONTH_SHORT_NAMES,
} from './format';

const store = useMunicipalityStore();
const report = computed(() => store.executiveReport);

// สมาชิกแต่ละคนมีบัญชีเดียวคือ "เงินสะสม" ซึ่งถอนไม่ได้
// ยอดคงเหลือใช้ contributionBalance (ผลรวม member_fund_balance.total_contribution
// ฝั่ง backend) ซึ่งเป็นตัวเลขที่ระบบใช้ตัดสินว่าสมาชิกจ่ายฌาปนกิจได้หรือไม่
// ส่วนแถวในการ์ดกองทุนเป็น "รายการเคลื่อนไหว" จาก ledger ที่ทำให้ยอดนี้เปลี่ยน
// เงินเข้ามี 2 ทาง: contribution (เติมให้ครบขั้นต่ำอัตโนมัติจากการขายขยะ) และ
// deposit (สมาชิกเลือกเก็บเพิ่มจากการขายขยะ)
const fundContributionBalance = computed(() => report.value.data?.fund.contributionBalance ?? 0);

// --- Fund card ------------------------------------------------------------------
// การ์ดนี้อ่านเป็นสมการเดียว: เงินเข้า − จ่ายฌาปนกิจ = เงินสะสมคงเหลือ
// เงินเข้า/เงินออกมาจาก ledger (fund_transaction) ส่วนคงเหลือมาจากผลรวมเงินสะสม
// รายคน ซึ่งเป็นตัวเลขที่ระบบใช้ตัดสินสิทธิ์จริง สองชุดนี้ต้องเท่ากันเสมอ - ทุก
// จุดที่เขียน member_fund_balance.total_contribution เขียน ledger คู่กันหมดแล้ว
// (funeralFundService, committeeSellRequestService) ถ้าเห็นการ์ดบวกลบไม่ลงตัว
// แปลว่าข้อมูลใน DB เพี้ยน ไม่ใช่การ์ดคำนวณผิด - ให้ไล่หาสมาชิกที่ ledger กับ
// total_contribution ไม่ตรงกัน
const fundFlow = computed(() => {
  const fund = report.value.data?.fund;
  const contributionIn = fund?.byType['contribution']?.amountIn ?? 0;
  const depositIn = fund?.byType['deposit']?.amountIn ?? 0;
  const totalIn = round2(contributionIn + depositIn);
  return {
    contributionIn,
    depositIn,
    totalIn,
    // Widths of the two segments of the "ที่มาของเงินเข้า" bar.
    contributionShare: totalIn > 0 ? (contributionIn / totalIn) * 100 : 0,
    depositShare: totalIn > 0 ? (depositIn / totalIn) * 100 : 0,
    welfareOut: fund?.welfarePayments.amountOut ?? 0,
    balance: fund?.contributionBalance ?? 0,
  };
});

function load() {
  void store.fetchExecutiveReport();
}

// --- Stat strip ----------------------------------------------------------------

const statStrip = computed(() => {
  const data = report.value.data;
  if (!data) return [];
  return [
    {
      label: 'ปริมาณขยะสะสม',
      value: formatQuantity(data.operations.totalQuantity),
      unit: 'กก.',
      icon: 'scale',
      iconClass: 'stat-icon-amber',
    },
    {
      label: 'สมาชิกทั้งหมด',
      value: data.members.total.toLocaleString(),
      unit: 'คน',
      icon: 'people',
      iconClass: 'stat-icon-blue',
    },
    {
      label: 'Estimated CO2 Credit',
      value: formatCarbon(data.co2Credit.estimatedKgCo2e),
      unit: 'kgCO2e',
      icon: 'co2',
      iconClass: 'stat-icon-blue',
    },
    {
      label: 'ยอดขายขยะสะสม',
      value: formatBaht(data.operations.totalAmount),
      unit: 'บาท',
      icon: 'recycling',
      iconClass: 'stat-icon-green',
    },
  ];
});

// --- Top waste types ------------------------------------------------------------
// operations.byWasteType is every type ever sold, heaviest first (backend sorts
// on quantity), and operations.totalQuantity is the same total the stat strip
// shows - so the shares here add up to what the officer sees above. The card
// shows the first 5; "ดูทั้งหมด" opens the full list in a dialog.
const allWasteRows = computed(() => {
  const data = report.value.data;
  if (!data) return [];
  const total = data.operations.totalQuantity;
  const heaviest = data.operations.byWasteType[0]?.quantity ?? 0;
  return data.operations.byWasteType.map((row, index) => {
    const percent = total > 0 ? (row.quantity / total) * 100 : 0;
    return {
      ...row,
      rank: String(index + 1).padStart(2, '0'),
      percentLabel: `${percent.toFixed(percent < 10 ? 1 : 0)}%`,
      // Bars are scaled against the leader so the ranking stays readable even
      // when every type is a small slice of the total.
      barWidth: `${heaviest > 0 ? (row.quantity / heaviest) * 100 : 0}%`,
    };
  });
});

const topWasteRows = computed(() => allWasteRows.value.slice(0, 5));
const allWasteOpen = ref(false);

// --- Member status breakdown ------------------------------------------------------
// Reading order and the slice colours are shared with the committee dashboard -
// see memberStatusRank / memberStatusTone in ./format.

// A sliver of a percent should not round away to "0%", so keep one decimal there.
const percentLabel = (percent: number) =>
  `${percent > 0 && percent < 1 ? percent.toFixed(1) : Math.round(percent)}%`;

// The donut reads one scope at a time. "ทุกหมู่บ้าน" is the executive report's
// municipality-wide summary; picking a หมู่ swaps in that village's own counts
// from the village report already loaded for the comparison chart further down,
// so switching costs no extra request.
const ALL_VILLAGES = '__all__';
// Households with no moo recorded are a real bucket in the village report - they
// need a key of their own, since their moo is null.
const NO_MOO = '__none__';

const villageRows = computed(() => store.villageReport.data?.villages ?? []);

function villageKey(row: VillageSummaryRow): string {
  return row.moo ?? NO_MOO;
}

const memberVillage = ref<string>(ALL_VILLAGES);

const memberVillageOptions = computed(() => [
  { value: ALL_VILLAGES, label: 'ทุกหมู่บ้าน' },
  ...villageRows.value.map((row) => ({ value: villageKey(row), label: row.fullLabel })),
]);

// Same four figures whichever scope is selected, so everything below this reads
// one shape and never branches on the selection again.
const memberSource = computed(() => {
  if (memberVillage.value === ALL_VILLAGES) {
    const members = report.value.data?.members;
    return {
      total: members?.total ?? 0,
      byStatus: members?.byStatus ?? {},
      newThisMonth: members?.newThisMonth ?? 0,
      householdCount: members?.householdCount ?? 0,
    };
  }
  const row = villageRows.value.find((village) => villageKey(village) === memberVillage.value);
  return {
    total: row?.memberCount ?? 0,
    byStatus: row?.byStatus ?? {},
    newThisMonth: row?.newThisMonth ?? 0,
    householdCount: row?.householdCount ?? 0,
  };
});

const memberStatusRows = computed(() => {
  const members = memberSource.value;
  return Object.entries(members.byStatus)
    .sort(([a], [b]) => memberStatusRank(a) - memberStatusRank(b))
    .map(([status, count]) => {
      const percent = members.total > 0 ? (count / members.total) * 100 : 0;
      return {
        status,
        count,
        percent,
        label: memberStatusLabel(status),
        color: memberStatusTone(status),
        percentLabel: percentLabel(percent),
      };
    });
});

// The donut is one <circle> per status: a dash as long as the slice, slid into
// place with a negative dash offset. A hairline gap separates neighbouring
// slices, unless a single status owns the whole ring and a gap would read as a nick.
const DONUT_RADIUS = 52;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

const memberDonutSegments = computed(() => {
  const slices = memberStatusRows.value.filter((row) => row.percent > 0);
  const gap = slices.length > 1 ? 2.5 : 0;
  let start = 0;
  return slices.map((row) => {
    const length = (row.percent / 100) * DONUT_CIRCUMFERENCE;
    const offset = -start;
    start += length;
    return {
      ...row,
      dash: `${Math.max(length - gap, 0.8)} ${DONUT_CIRCUMFERENCE}`,
      offset,
    };
  });
});

// The card leads with "how many are still active" - the number an officer scans
// for first - so the active share gets the middle of the donut.
const memberHeadline = computed(() => {
  const members = memberSource.value;
  const total = members.total;
  const active = members.byStatus.active ?? 0;
  return {
    total,
    active,
    pending: members.byStatus.pending ?? 0,
    percentLabel: percentLabel(total > 0 ? (active / total) * 100 : 0),
  };
});

const co2Excluded = computed(() => report.value.data?.co2Credit.excludedWasteTypes ?? []);

// --- Chart period switch ----------------------------------------------------------
// "รายเดือน" reads the executive report's rolling 6-month window; the other two
// need a full calendar year, which only the yearly report endpoint provides.
type RangeKey = 'month' | 'quarter' | 'year';

const rangeOptions: { value: RangeKey; label: string }[] = [
  { value: 'month', label: 'รายเดือน' },
  { value: 'quarter', label: 'รายไตรมาส' },
  { value: 'year', label: 'รายปี' },
];

const range = ref<RangeKey>('month');
const currentYear = new Date().getFullYear();
const yearly = computed(() => store.yearlyReport);

function setRange(value: RangeKey) {
  range.value = value;
  if (value !== 'month' && !yearly.value.data) {
    void store.fetchYearlyReport(currentYear);
  }
}

const activeRange = computed(() => {
  if (range.value === 'year') {
    return { title: 'รายเดือน', caption: `12 เดือนของปี ${currentYear + 543}` };
  }
  if (range.value === 'quarter') {
    return { title: 'รายไตรมาส', caption: `แยกตามไตรมาสของปี ${currentYear + 543}` };
  }
  return { title: 'รายเดือน', caption: '6 เดือนล่าสุด' };
});

const chartLoading = computed(() => range.value !== 'month' && yearly.value.loading && !yearly.value.data);

interface ChartPoint {
  label: string;
  quantity: number;
  totalAmount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const chartPoints = computed<ChartPoint[]>(() => {
  if (range.value === 'month') {
    return (report.value.data?.trends.last6Months ?? []).map((point) => ({
      label: formatMonthKey(point.month),
      quantity: round2(point.quantity),
      totalAmount: round2(point.totalAmount),
    }));
  }

  const rows = yearly.value.data?.monthlyBreakdown ?? [];
  if (range.value === 'year') {
    return rows.map((row) => ({
      label: THAI_MONTH_SHORT_NAMES[row.month - 1] ?? String(row.month),
      quantity: round2(row.quantity),
      totalAmount: round2(row.totalAmount),
    }));
  }

  return [0, 1, 2, 3].map((quarter) => {
    const months = rows.filter((row) => Math.floor((row.month - 1) / 3) === quarter);
    return {
      label: `ไตรมาส ${quarter + 1}`,
      quantity: round2(months.reduce((sum, row) => sum + row.quantity, 0)),
      totalAmount: round2(months.reduce((sum, row) => sum + row.totalAmount, 0)),
    };
  });
});

const chartHasData = computed(() => chartPoints.value.some((point) => point.quantity > 0 || point.totalAmount > 0));

const QUANTITY_SERIES = 'ปริมาณขยะ (กก.)';
const AMOUNT_SERIES = 'ยอดขาย (บาท)';

const chartSeries = computed(() => [
  { name: QUANTITY_SERIES, type: 'column', data: chartPoints.value.map((point) => point.quantity) },
  { name: AMOUNT_SERIES, type: 'line', data: chartPoints.value.map((point) => point.totalAmount) },
]);

const chartOptions = computed<ApexOptions>(() => ({
  chart: { toolbar: { show: false }, fontFamily: 'inherit' },
  colors: ['#9fcfb4', '#0b4f36'],
  stroke: { width: [0, 2.5], curve: 'smooth', lineCap: 'round' },
  plotOptions: { bar: { borderRadius: 6, columnWidth: '48%' } },
  markers: { size: [0, 4], strokeColors: '#ffffff', strokeWidth: 2, hover: { size: 6 } },
  dataLabels: { enabled: false },
  legend: {
    position: 'top',
    horizontalAlign: 'right',
    fontSize: '12.5px',
    labels: { colors: '#5f6f66' },
    markers: { size: 5 },
    itemMargin: { horizontal: 10 },
  },
  grid: { borderColor: '#edf2ee', strokeDashArray: 0, padding: { left: 4, right: 4 } },
  xaxis: {
    categories: chartPoints.value.map((point) => point.label),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#84918a', fontSize: '12px' } },
  },
  yaxis: [
    {
      seriesName: QUANTITY_SERIES,
      decimalsInFloat: 0,
      forceNiceScale: true,
      labels: { formatter: (value: number) => formatQuantity(value), style: { colors: '#84918a', fontSize: '12px' } },
    },
    {
      seriesName: AMOUNT_SERIES,
      opposite: true,
      decimalsInFloat: 0,
      forceNiceScale: true,
      labels: { formatter: (value: number) => formatBaht(value), style: { colors: '#84918a', fontSize: '12px' } },
    },
  ],
  tooltip: {
    shared: true,
    intersect: false,
    // One formatter switching on the series index: the per-series array form is
    // not honoured on this ApexCharts version's mixed bar+line charts.
    y: {
      formatter: (value: number, { seriesIndex }: { seriesIndex: number }) =>
        seriesIndex === 0 ? `${formatQuantity(value)} กก.` : `${formatBaht(value)} บาท`,
    },
  },
}));

// --- CO2 credit chart -------------------------------------------------------------
// Same period switch as the sales chart, stacked by waste type so a bucket's
// height is the credit earned and its segments say where that credit came from.
// Only the heaviest few types get their own colour - the tail is folded into
// "อื่น ๆ" so the legend stays readable no matter how many types exist.
const CO2_TOP_SERIES = 6;
const CO2_OTHER_LABEL = 'อื่น ๆ';

// Distinct hues, not a green ramp: a segment has to say *which* waste type it is
// at a glance, and a one-hue ramp only encodes magnitude. Brand green leads, then
// five hues far enough apart to survive colour-vision deficiency - validated on
// adjacent pairs against the white card at worst CVD ΔE 13.2 / normal-vision
// ΔE 19.3, every slot ≥3:1 on the surface. The tail fold is deliberately neutral:
// "อื่น ๆ" is not an identity, so it sits outside the categorical set.
const CO2_SERIES_COLORS = ['#1e8a44', '#2a78d6', '#eb6834', '#4a3aa7', '#c98500', '#d55181'];
const CO2_OTHER_COLOR = '#3f4a44';

interface Co2Bucket {
  label: string;
  byWasteType: Map<string, number>;
}

function co2BucketOf(label: string, points: Co2MonthlyPoint[]): Co2Bucket {
  const byWasteType = new Map<string, number>();
  for (const point of points) {
    for (const slice of point.byWasteType) {
      byWasteType.set(slice.wasteName, (byWasteType.get(slice.wasteName) ?? 0) + slice.estimatedKgCo2e);
    }
  }
  return { label, byWasteType };
}

const co2Buckets = computed<Co2Bucket[]>(() => {
  if (range.value === 'month') {
    return (report.value.data?.co2Credit.monthlySeries ?? []).map((point) =>
      co2BucketOf(formatMonthKey(point.month), [point]),
    );
  }

  const points = yearly.value.data?.co2MonthlySeries ?? [];
  const byMonthNumber = new Map(points.map((point) => [Number(point.month.slice(5, 7)), point]));

  if (range.value === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const point = byMonthNumber.get(index + 1);
      return co2BucketOf(THAI_MONTH_SHORT_NAMES[index] ?? String(index + 1), point ? [point] : []);
    });
  }

  return [0, 1, 2, 3].map((quarter) =>
    co2BucketOf(
      `ไตรมาส ${quarter + 1}`,
      [1, 2, 3].map((offset) => byMonthNumber.get(quarter * 3 + offset)).filter((point) => !!point),
    ),
  );
});

// A colour belongs to a waste type, never to its rank inside the selected period:
// slots are handed out on all-time volume, so switching รายเดือน/รายไตรมาส/รายปี
// never repaints a series out from under the reader.
const co2SeriesSlots = computed(() => {
  const ranked = report.value.data?.co2Credit.byWasteType ?? [];
  return new Map(
    ranked
      .slice(0, CO2_TOP_SERIES)
      .map((row, index) => [row.wasteName, CO2_SERIES_COLORS[index] ?? CO2_OTHER_COLOR]),
  );
});

const co2ChartEntries = computed(() => {
  const buckets = co2Buckets.value;
  const slots = co2SeriesSlots.value;

  const entries = [...slots].map(([name, color]) => ({
    name,
    color,
    data: buckets.map((bucket) => round2(bucket.byWasteType.get(name) ?? 0)),
  }));

  const other = buckets.map((bucket) =>
    round2(
      [...bucket.byWasteType.entries()]
        .filter(([name]) => !slots.has(name))
        .reduce((sum, [, value]) => sum + value, 0),
    ),
  );
  if (other.some((value) => value > 0)) {
    entries.push({ name: CO2_OTHER_LABEL, color: CO2_OTHER_COLOR, data: other });
  }

  // A type with nothing in the selected period would only add a dead legend chip.
  return entries.filter((entry) => entry.data.some((value) => value > 0));
});

const co2ChartSeries = computed(() => co2ChartEntries.value.map(({ name, data }) => ({ name, data })));

const co2ChartHasData = computed(() => co2ChartEntries.value.length > 0);

const co2ChartOptions = computed<ApexOptions>(() => ({
  chart: { stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
  colors: co2ChartEntries.value.map((entry) => entry.color),
  plotOptions: { bar: { borderRadius: 6, borderRadiusApplication: 'end', columnWidth: '52%' } },
  // 2px of the card showing between segments - the seam is what lets neighbouring
  // colours read as two blocks instead of one gradient.
  stroke: { width: 2, colors: ['#ffffff'] },
  dataLabels: { enabled: false },
  legend: {
    position: 'bottom',
    horizontalAlign: 'left',
    fontSize: '12.5px',
    labels: { colors: '#5f6f66' },
    markers: { size: 5 },
    itemMargin: { horizontal: 10, vertical: 4 },
  },
  grid: { borderColor: '#edf2ee', strokeDashArray: 0, padding: { left: 4, right: 4 } },
  xaxis: {
    categories: co2Buckets.value.map((bucket) => bucket.label),
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: { style: { colors: '#84918a', fontSize: '12px' } },
  },
  yaxis: {
    decimalsInFloat: 0,
    forceNiceScale: true,
    labels: { formatter: (value: number) => formatCarbon(value), style: { colors: '#84918a', fontSize: '12px' } },
  },
  tooltip: {
    shared: true,
    intersect: false,
    y: { formatter: (value: number) => `${formatCarbon(value)} kgCO2e` },
  },
}));

// --- Per-village comparison -------------------------------------------------------
// Answers the three questions the municipality asks of every หมู่บ้าน in one
// frame: how much waste it sold, what that waste fetched, and the CO2 credit it
// earned. All-time, and deliberately outside the period switch above - fund
// balances have no history, so a period-scoped waste figure next to a live money
// figure would be two clocks in one row.

const villageReport = computed(() => store.villageReport);
const villageTotals = computed(() => villageReport.value.data?.totals ?? null);

function loadVillages() {
  void store.fetchVillageReport();
}

// One hue for every bubble, on purpose. Position already tells the villages
// apart, so a categorical ramp would only re-say what x and y have said - and a
// bubble plot is an "any two marks can sit side by side" form, where the ramp
// validated for this page stops being colourblind-safe past three slots (four
// villages already break it). Identity rides on the per-bubble label and the
// tooltip instead. #1e8a44 clears 3:1 against the white card.
const VILLAGE_BUBBLE_COLOR = '#1e8a44';

interface VillageBubbleRow {
  // The bare หมู่ number ('1'), not the 'หมู่ 1' axis label: it has to fit
  // inside a 12px bubble.
  moo: string;
  fullLabel: string;
  memberCount: number;
  quantity: number;
  amount: number;
  co2: number;
}

const villageBubbleRows = computed<VillageBubbleRow[]>(() =>
  villageRows.value.map((row) => ({
    moo: row.moo ?? '?',
    fullLabel: row.fullLabel,
    memberCount: row.memberCount,
    quantity: round2(row.totalQuantity),
    amount: round2(row.totalAmount),
    co2: round2(row.co2Credit.estimatedKgCo2e),
  })),
);

// How big the whole set of bubbles draws, from how many there are to draw.
//
// ApexCharts turns z into a radius as `z / ((maxZ - minZ) / gridHeight * 16)`,
// which pins the *spread* between the smallest and largest bubble to
// gridHeight/16 - ~35px at this chart's 600px height - no matter what z it is
// handed: scaling every z up or down changes nothing, which is why the chart is
// tall. The one lever left is a constant floor added to every z, lifting the
// whole set together, so the smallest bubble is `floor x spread` across and the
// largest is that plus the spread. Four villages have the room for a 0.55 floor
// (~19px and ~54px radii); a dozen do not, so the floor drops as the plot fills.
//
// Phone: the chart drops to 380px (see the template), which on its own shrinks
// the spread to ~20px; the lower caps keep one lone village from filling a plot
// that is only ~260px wide.
function villageBubbleScale(count: number, phone: boolean): { floor: number; maxRadius: number } {
  if (count <= 6) return { floor: 0.55, maxRadius: phone ? 34 : 70 };
  if (count <= 12) return { floor: 0.25, maxRadius: phone ? 26 : 48 };
  return { floor: 0.08, maxRadius: phone ? 18 : 32 };
}

// Same 720px breakpoint as the page's phone CSS.
const $q = useQuasar();
const isPhone = computed(() => $q.screen.width <= 720);

const villageBubbleSeries = computed(() => {
  const rows = villageBubbleRows.value;
  const maxCo2 = rows.reduce((max, row) => Math.max(max, row.co2), 0);
  const { floor } = villageBubbleScale(rows.length, isPhone.value);
  return [
    {
      name: 'หมู่บ้าน',
      data: rows.map((row) => ({
        x: row.quantity,
        y: row.amount,
        // Square-rooted, because a bubble is read as an area: handing over the
        // credit itself would grow the area with its *square* - หมู่ 1 at 139x
        // หมู่ 4's credit would draw ~19,000x the ink. Every credit at zero
        // would leave ApexCharts dividing by a zero z-range (NaN radii, no
        // bubbles at all), so that case falls back to one flat size.
        z: maxCo2 > 0 ? round2(floor + Math.sqrt(row.co2 / maxCo2)) : 1,
      })),
    },
  ];
});

const villageBubbleHasData = computed(() =>
  villageBubbleRows.value.some((row) => row.quantity > 0 || row.amount > 0),
);

// A bubble sits *on* its coordinate rather than under it, so an axis that stops
// at the largest value cuts the biggest bubble in half - and at this size the
// biggest is ~58px across. Round the top up to a nice step ~15% clear of the
// data - on a 555px plot that is always at least 83px, so the top bubble keeps
// its full circle - instead of leaving it to forceNiceScale.
function villageAxisMax(values: number[]): number {
  const maxValue = values.reduce((max, value) => Math.max(max, value), 0);
  if (maxValue <= 0) return 10;
  const padded = maxValue * 1.15;
  const step = 10 ** Math.floor(Math.log10(padded)) / 4;
  return Math.ceil(padded / step) * step;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// fullLabel is committee-entered text and the tooltip is built as an HTML
// string, so the name is escaped rather than trusted.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

const villageBubbleOptions = computed<ApexOptions>(() => {
  const phone = isPhone.value;
  // Axis text and tick count step down on a phone so the labels do not crowd a
  // ~260px plot.
  const axisFont = phone ? '10.5px' : '12px';
  const tickAmount = phone ? 4 : 5;
  return {
    // No zoom: four-to-a-dozen bubbles never need it, and a stray drag that
    // rescales the plot only leaves the officer wondering what happened.
    chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    colors: [VILLAGE_BUBBLE_COLOR],
    fill: { opacity: 0.58 },
    // The 2px white ring keeps two overlapping villages reading as two bubbles.
    // `size` never reaches a bubble's radius (z decides that), but it is what
    // widens the marker clip region - it has to clear the largest radius or a
    // bubble parked on an axis gets sliced by the grid edge.
    markers: { size: 90, strokeWidth: 2, strokeColors: ['#ffffff'] },
    plotOptions: {
      bubble: {
        zScaling: true,
        // Backstops either side of the floor, not the working scale: a single
        // village (or a dozen identical ones) leaves ApexCharts with a zero
        // z-range and an infinite radius, and maxRadius is what catches it.
        minBubbleRadius: phone ? 6 : 8,
        maxBubbleRadius: villageBubbleScale(villageBubbleRows.value.length, phone).maxRadius,
      },
    },
    // One series, so a legend chip would only repeat the panel title. The
    // axis titles and the tooltip name the channels instead.
    legend: { show: false },
    dataLabels: {
      enabled: true,
      // For bubbles ApexCharts hands the formatter the z value - here the
      // square-rooted radius input - so the label is read off the row by index.
      // It always lands dead-centre too (offsetY is discarded for bubbles), which
      // is why the text has to be short enough to sit inside the smallest one.
      formatter: (_value: string | number | number[], opts?: { dataPointIndex: number }) =>
        villageBubbleRows.value[opts?.dataPointIndex ?? 0]?.moo ?? '',
      // Ink, no chip: a white pill reads at any bubble size but swallows a 12px
      // bubble whole. Bare ink clears 4.5:1 on the fill and ~13:1 where it spills
      // onto the card.
      style: { fontSize: phone ? '10.5px' : '12px', fontWeight: 700, colors: ['#123c27'] },
      background: { enabled: false },
    },
    // Both axes carry a measure here, so vertical gridlines earn their keep too -
    // a bubble's x is as much a value to trace as its y.
    grid: { borderColor: '#edf2ee', strokeDashArray: 0, xaxis: { lines: { show: true } } },
    xaxis: {
      type: 'numeric',
      min: 0,
      max: villageAxisMax(villageBubbleRows.value.map((row) => row.quantity)),
      tickAmount,
      title: {
        text: 'ปริมาณขยะที่ขายได้ (กก.)',
        style: { color: '#84918a', fontSize: axisFont, fontWeight: 600 },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        formatter: (value: string | number) => formatQuantity(Number(value)),
        style: { colors: '#84918a', fontSize: axisFont },
      },
      // The crosshair label would print a bare x with no unit; the tooltip has it.
      tooltip: { enabled: false },
    },
    yaxis: {
      min: 0,
      max: villageAxisMax(villageBubbleRows.value.map((row) => row.amount)),
      tickAmount,
      title: { text: 'ยอดขาย (บาท)', style: { color: '#84918a', fontSize: axisFont, fontWeight: 600 } },
      labels: { formatter: (value: number) => formatBaht(value), style: { colors: '#84918a', fontSize: axisFont } },
    },
    tooltip: {
      // Hover the bubble itself: with four points spread over a wide plot, the
      // nearest-point alternative would pop a village 400px from the pointer.
      shared: false,
      intersect: true,
      // Custom rather than x/y formatters: a bubble carries three measures plus a
      // head count, and the z ApexCharts would print is the square-rooted radius.
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const row = villageBubbleRows.value[dataPointIndex];
        if (!row) return '';
        return `<div class="bubble-tip">
          <div class="bubble-tip-name">${escapeHtml(row.fullLabel)}</div>
          <div class="bubble-tip-row"><span>ปริมาณขยะ</span><strong>${formatQuantity(row.quantity)} กก.</strong></div>
          <div class="bubble-tip-row"><span>ยอดขาย</span><strong>${formatBaht(row.amount)} บาท</strong></div>
          <div class="bubble-tip-row"><span>CO2 credit</span><strong>${formatCarbon(row.co2)} kgCO2e</strong></div>
          <div class="bubble-tip-row"><span>สมาชิก</span><strong>${row.memberCount} คน</strong></div>
        </div>`;
      },
    },
  };
});

// --- Per-village savings ---------------------------------------------------------
// "หมู่บ้านนี้มีเงินสะสมเท่าไหร่" as a horizontal bar: one bar per village, its
// members' savings added up (one balance each, never withdrawable).
//
// A live snapshot, not a period figure: member_fund_balance carries no history,
// which is why the whole village section sits outside the page's period switch.
const VILLAGE_FUND_SERIES = 'เงินสะสมของสมาชิก';

// Slot 1 of the page's categorical set (see CO2_SERIES_COLORS).
const VILLAGE_FUND_COLORS = ['#1e8a44'];

interface VillageFundRow {
  label: string;
  fullLabel: string;
  total: number;
}

const villageFundRows = computed<VillageFundRow[]>(() =>
  villageRows.value.map((row) => ({
    label: row.label,
    fullLabel: row.fullLabel,
    total: round2(row.fund.contributionBalance),
  })),
);

const villageFundTotal = computed(() =>
  round2(villageFundRows.value.reduce((sum, row) => sum + row.total, 0)),
);

const villageFundHasData = computed(() => villageFundRows.value.some((row) => row.total > 0));

// Where the money axis stops. Handed a bare max, ApexCharts will happily open the
// scale at -2,250 to make its five ticks land on round numbers - so the max is
// picked here instead, as a round step times the tick count, with the floor
// pinned at 0. The small headroom keeps the longest bar off the plot edge; the
// room for the total label printed past its tip is grid padding, not axis range,
// so a bigger label never costs the bars any length.
const VILLAGE_FUND_TICKS = 5;
const VILLAGE_FUND_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function villageFundAxisMax(values: number[]): number {
  const maxValue = values.reduce((max, value) => Math.max(max, value), 0);
  const perTick = (maxValue > 0 ? maxValue * 1.08 : 100) / VILLAGE_FUND_TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(perTick));
  const step = VILLAGE_FUND_STEPS.map((multiple) => multiple * magnitude).find((value) => value >= perTick);
  return (step ?? 10 * magnitude) * VILLAGE_FUND_TICKS;
}

// Fixed 46px per village rather than one height for the whole chart: that is what
// keeps the bars at the 24px cap (barHeight 52%) whether there are 4 villages or
// 15, instead of letting four of them draw as slabs.
const villageFundChartHeight = computed(() => villageFundRows.value.length * 46 + 96);

const villageFundSeries = computed(() => [
  { name: VILLAGE_FUND_SERIES, data: villageFundRows.value.map((row) => row.total) },
]);

const villageFundOptions = computed<ApexOptions>(() => ({
  chart: { stacked: true, toolbar: { show: false }, fontFamily: 'inherit' },
  colors: VILLAGE_FUND_COLORS,
  plotOptions: {
    bar: {
      horizontal: true,
      barHeight: '52%',
      borderRadius: 4,
      borderRadiusApplication: 'end',
      dataLabels: {
        // The total at the bar's tip is the answer the card exists to give, so
        // it is labelled outright instead of being left to the tooltip. Drawn by
        // its own switch - `dataLabels.enabled: false` below only silences the
        // per-segment numbers, which would collide inside a thin bar.
        total: {
          enabled: true,
          offsetX: 8,
          formatter: (value?: string) => `${formatBaht(Number(value))} บาท`,
          style: { fontSize: '12px', fontWeight: 700, color: '#16352a' },
        },
      },
    },
  },
  // 2px of the card between the two segments - the seam is what makes them read
  // as two amounts rather than one bar in a gradient.
  stroke: { width: 2, colors: ['#ffffff'] },
  dataLabels: { enabled: false },
  legend: {
    position: 'top',
    horizontalAlign: 'left',
    fontSize: '12.5px',
    labels: { colors: '#5f6f66' },
    markers: { size: 5 },
    itemMargin: { horizontal: 10, vertical: 4 },
  },
  // Only the money axis gets gridlines: a horizontal line per village would just
  // underline the bar it belongs to.
  grid: {
    borderColor: '#edf2ee',
    strokeDashArray: 0,
    // Right padding, not axis headroom: this is the gutter the total label sits
    // in once it clears the end of the longest bar.
    padding: { right: 90 },
    xaxis: { lines: { show: true } },
    yaxis: { lines: { show: false } },
  },
  xaxis: {
    categories: villageFundRows.value.map((row) => row.label),
    min: 0,
    max: villageFundAxisMax(villageFundRows.value.map((row) => row.total)),
    tickAmount: VILLAGE_FUND_TICKS,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      formatter: (value: string | number) => formatBaht(Number(value)),
      style: { colors: '#84918a', fontSize: '12px' },
    },
  },
  yaxis: {
    labels: { maxWidth: 150, style: { colors: '#5f6f66', fontSize: '12.5px', fontWeight: 600 } },
  },
  tooltip: {
    shared: true,
    intersect: false,
    // The axis carries the short 'หมู่ 1'; the tooltip has room for the name the
    // committee actually entered.
    x: {
      formatter: (value: string | number, opts?: { dataPointIndex: number }) =>
        villageFundRows.value[opts?.dataPointIndex ?? 0]?.fullLabel ?? String(value),
    },
    y: { formatter: (value: number) => `${formatBaht(value)} บาท` },
  },
}));

// The same links as the side menu (municipalityMenu in layouts/MainLayout.vue),
// minus this page itself.
const menuActions = [
  { label: 'ติดตามสมาชิก', to: '/municipality/members', icon: 'group', primary: true },
  { label: 'ผลการดำเนินงาน', to: '/municipality/operations', icon: 'insights', primary: false },
  { label: 'ติดตามกองทุน', to: '/municipality/fund', icon: 'savings', primary: false },
  // ซ่อนปุ่มรายงานไว้ก่อนชั่วคราว - หน้า /municipality/reports ยังอยู่ เปิดกลับได้โดยเอาคอมเมนต์ออก
  // { label: 'รายงาน', to: '/municipality/reports', icon: 'bar_chart', primary: false },
  { label: 'รายงานการเสียชีวิต', to: '/municipality/funeral', icon: 'volunteer_activism', primary: false },
  { label: 'ออกรายงาน PDF', to: '/municipality/pdf-report', icon: 'picture_as_pdf', primary: false },
];

const villageMaxSales = computed(() =>
  villageRows.value.reduce((max, row) => Math.max(max, row.totalAmount), 0),
);

function villageSalesShare(row: VillageSummaryRow): number {
  return villageMaxSales.value > 0 ? (row.totalAmount / villageMaxSales.value) * 100 : 0;
}

const villageColumns = [
  {
    name: 'village',
    align: 'left' as const,
    label: 'หมู่บ้าน',
    field: (row: VillageSummaryRow) => row.fullLabel,
  },
  {
    name: 'members',
    align: 'right' as const,
    label: 'สมาชิก (คน)',
    field: (row: VillageSummaryRow) => row.memberCount,
  },
  {
    name: 'quantity',
    align: 'right' as const,
    label: 'ปริมาณขยะ (กก.)',
    field: (row: VillageSummaryRow) => formatQuantity(row.totalQuantity),
  },
  {
    name: 'amount',
    align: 'right' as const,
    label: 'ยอดขาย (บาท)',
    field: (row: VillageSummaryRow) => formatBaht(row.totalAmount),
  },
  {
    name: 'co2',
    align: 'right' as const,
    label: 'CO2 credit (kgCO2e)',
    field: (row: VillageSummaryRow) => formatCarbon(row.co2Credit.estimatedKgCo2e),
  },
  // The figure the savings card plots, spelled out to the baht for anyone
  // copying it into a report.
  {
    name: 'savings',
    align: 'right' as const,
    label: 'เงินสะสม (บาท)',
    field: (row: VillageSummaryRow) => formatBaht(row.fund.contributionBalance),
  },
];

// Non-kg waste types never enter a kgCO2e figure, so the table says once which
// ones the CO2 column leaves out rather than repeating it per village.
const villageExcludedNote = computed(() => {
  const names = new Set<string>();
  for (const row of villageRows.value) {
    for (const excluded of row.co2Credit.excludedWasteTypes) names.add(excluded.wasteName);
  }
  return [...names].join(', ');
});

onMounted(() => {
  load();
  loadVillages();
});
</script>

<style lang="scss" scoped>
@use './theme' as *;

// --- Page header ----------------------------------------------------------------

// --- Menu tiles ---------------------------------------------------------------------
// Same tile as the committee dashboard (.menu-action in
// pages/committee/CommitteeDashboardPage) and the member home page: icon over
// label, one tap to the page. auto-fit folds the six to fewer per row on
// narrower screens.

.menu-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 22px;
}

.menu-action {
  min-height: 96px;
  padding: 14px 10px;
  color: #18231e;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid rgba(7, 95, 56, 0.12);
  border-radius: 16px;
  box-shadow: 0 10px 26px rgba(35, 74, 49, 0.06);
  font-size: 16px;
  font-weight: 900;
}

.menu-action :deep(.q-icon) {
  margin-bottom: 6px;
  color: #087f49;
  font-size: 30px;
}

.menu-action.is-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #00693f, #0a9a52);
  border-color: transparent;
  box-shadow: 0 14px 30px rgba(7, 95, 56, 0.22);
}

.menu-action.is-primary :deep(.q-icon) {
  color: #ffffff;
}

@media (max-width: 720px) {
  .menu-actions {
    gap: 12px;
  }

  .menu-action {
    min-height: 84px;
    font-size: 15px;
  }
}

.dash-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid #e4ebe5;
}

.dash-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dash-tab {
  padding: 7px 12px;
  color: #6d7c74;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease;
}

.dash-tab:hover {
  color: #0b7a47;
}

.dash-tab.is-active {
  color: #0b7a47;
  border-bottom-color: #0b7a47;
}

// --- Headline + stat strip --------------------------------------------------------

.dash-overview {
  margin-top: 24px;
  padding: 28px 30px 8px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 20px;
  box-shadow: 0 1px 2px rgba(23, 46, 34, 0.04);
}

.dash-headline {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
}

.headline-main {
  min-width: 0;
}

.headline-label {
  color: #6d7c74;
  font-size: 13.5px;
  font-weight: 600;
}

.headline-value {
  margin-top: 6px;
  color: #14503a;
  font-size: clamp(40px, 6vw, 68px);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.headline-value span {
  margin-left: 8px;
  color: #8a958e;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0;
}

.dash-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  margin-top: 26px;
  border-top: 1px solid #eaf0ec;
}

.dash-stat {
  padding: 22px 24px;
  border-left: 1px solid #eaf0ec;
}

.dash-stat:first-child {
  padding-left: 0;
  border-left: none;
}

.stat-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5f6f66;
  font-size: 13px;
  font-weight: 600;
}

.stat-head .q-icon {
  font-size: 18px;
}

.stat-icon-green {
  color: #1e8a44;
}

.stat-icon-blue {
  color: #2379b8;
}

.stat-icon-amber {
  color: #a3691a;
}

.stat-value {
  margin-top: 8px;
  color: #16352a;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  overflow-wrap: anywhere;
}

.stat-value span {
  margin-left: 4px;
  color: #8a958e;
  font-size: 13.5px;
  font-weight: 600;
}

// --- Top waste ranking -------------------------------------------------------------

.dash-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr);
  gap: 18px;
  margin-top: 24px;
}

.waste-rank {
  display: grid;
  gap: 18px;
  margin-top: 24px;
}

// The full list can run long - it scrolls inside the dialog instead of
// pushing the dialog past the screen.
.waste-rank--all {
  max-height: min(60vh, 560px);
  margin-top: 0;
  padding-right: 6px;
  overflow-y: auto;
}

.waste-amount {
  margin-top: 6px;
  color: #0d7a44;
  font-size: 12.5px;
  font-weight: 700;
  text-align: right;
}

.panel-link--button {
  padding: 0;
  font-family: inherit;
  background: none;
  border: 0;
  cursor: pointer;
}

.waste-line {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.waste-no {
  color: #9ccdb0;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.waste-name {
  min-width: 0;
  flex: 1;
  color: #26352d;
  font-size: 14.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.waste-figure {
  color: #5f6f66;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.waste-track {
  margin-top: 8px;
  height: 6px;
  background: #eef4f0;
  border-radius: 999px;
  overflow: hidden;
}

.waste-fill {
  height: 100%;
  background: #1e8a44;
  border-radius: 999px;
}

.waste-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eaf0ec;
  color: #83908a;
  font-size: 12.5px;
  font-weight: 500;
}

// --- Remaining panels ----------------------------------------------------------------

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr);
  gap: 18px;
  margin-top: 24px;
}

.co2-dashboard-grid {
  grid-template-columns: 1fr;
}

.co2-total {
  color: #14503a;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  text-align: right;
}

.co2-total span {
  margin-left: 4px;
  color: #8a958e;
  font-size: 13.5px;
  font-weight: 600;
}

.co2-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 22px;
}

.co2-metric {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  background: #f7faf8;
  border: 1px solid #e4ebe5;
  border-radius: 12px;
}

.co2-metric span {
  color: #74827a;
  font-size: 12.5px;
  font-weight: 500;
}

.co2-metric strong {
  color: #16352a;
  font-size: 16px;
  font-weight: 700;
}

.co2-excluded-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 14px;
  color: #74827a;
  background: #f7faf8;
  border: 1px solid #e4ebe5;
  border-radius: 10px;
  font-size: 12.5px;
  font-weight: 500;
}

.co2-excluded-note .q-icon {
  margin-top: 1px;
  font-size: 16px;
}

// Outlined variant of the shared .panel-link, for the one panel whose link is a
// real call to action rather than a footnote.
.panel-link--pill {
  gap: 2px;
  padding: 6px 10px 6px 14px;
  border: 1px solid #d6e8db;
  border-radius: 999px;
  transition:
    background 0.18s ease,
    border-color 0.18s ease;
}

.panel-link--pill:hover {
  background: #f2f9f4;
  border-color: #a9cdb4;
  text-decoration: none;
}

// Village picker + "ดูรายชื่อ" travel together on the right of the panel head.
.panel-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.village-select {
  min-width: 190px;
}

.member-split {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-top: 22px;
}

.member-donut {
  position: relative;
  display: grid;
  place-items: center;
  width: 136px;
  min-width: 136px;
}

.member-donut svg {
  width: 100%;
  height: auto;
}

.donut-track {
  fill: none;
  stroke: #eef4f0;
  stroke-width: 14;
}

.donut-arc {
  fill: none;
  stroke-width: 14;
  stroke-linecap: butt;
  transition: stroke-dasharray 0.4s ease;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 1px;
  line-height: 1.1;
  text-align: center;
  pointer-events: none;
}

.donut-center strong {
  color: #14503a;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.donut-center span {
  color: #6d7c74;
  font-size: 12px;
  font-weight: 600;
}

.donut-center small {
  color: #8a958e;
  font-size: 11px;
  font-weight: 500;
}

.member-rows {
  display: grid;
  align-content: center;
  gap: 2px;
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.member-row {
  position: relative;
  display: grid;
  grid-template-columns: 3px minmax(0, 1fr) auto 42px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 10px;
}

// The active share is the number the card is built around, so its row keeps a
// tinted plate while the rest stay quiet.
.member-row.is-lead {
  background: #f2f9f4;
}

.member-tick {
  width: 3px;
  height: 18px;
  border-radius: 999px;
}

.member-name {
  color: #46554d;
  font-size: 14px;
  font-weight: 500;
}

.member-row.is-lead .member-name {
  color: #16352a;
  font-weight: 600;
}

.member-count {
  color: #16352a;
  font-size: 16px;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.member-percent {
  color: #8a958e;
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.member-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eef3ef;
}

.member-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
  color: #74827a;
  font-size: 12.5px;
  font-weight: 500;
}

.member-fact {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.member-fact + .member-fact {
  padding-left: 18px;
  border-left: 1px solid #e4ebe5;
}

.member-fact strong {
  color: #16352a;
  font-size: 14.5px;
  font-weight: 700;
}

.member-alert {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  color: #a3691a;
  background: #faf1e0;
  border-radius: 999px;
  font-size: 12.5px;
  font-weight: 600;
}

.member-alert .q-icon {
  font-size: 15px;
}

// --- Funeral fund card ---

// Balance tile: the one figure the card answers, on the brand gradient.
.fund-balance {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 18px;
  padding: 18px 20px;
  overflow: hidden;
  color: #ffffff;
  background: linear-gradient(135deg, #00693f, #0a9a52);
  border-radius: 16px;
  box-shadow: 0 14px 30px rgba(7, 95, 56, 0.18);

  // Soft circle in the corner - depth without an image.
  &::after {
    content: '';
    position: absolute;
    top: -46px;
    right: -30px;
    width: 140px;
    height: 140px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
  }
}

.fund-balance-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  min-width: 46px;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 14px;
  font-size: 24px;
}

.fund-balance-copy {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.fund-balance-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.85;
}

.fund-balance-value {
  margin-top: 2px;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;

  span {
    margin-left: 4px;
    font-size: 14px;
    font-weight: 600;
    opacity: 0.8;
  }
}

.fund-flow-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.fund-flow {
  min-width: 0;
  padding: 14px;
  border-radius: 14px;
}

.fund-flow--in {
  background: #eef8f1;

  .fund-flow-icon {
    color: #0b6b40;
    background: #d4eedc;
  }

  .fund-flow-value {
    color: #0b6b40;
  }
}

.fund-flow--out {
  background: #fdf3ee;

  .fund-flow-icon {
    color: #b4532a;
    background: #f8dfd2;
  }

  .fund-flow-value {
    color: #9a4422;
  }
}

.fund-flow-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #46554d;
  font-size: 13px;
  font-weight: 600;
}

.fund-flow-icon {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  min-width: 26px;
  border-radius: 8px;
  font-size: 15px;
}

.fund-flow-value {
  margin-top: 10px;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.fund-flow-note {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 600;
}

// Composition of "เงินเข้า": one bar split in two, legend underneath.
.fund-mix {
  margin-top: 18px;
}

.fund-mix-label {
  color: #6d7c74;
  font-size: 12.5px;
  font-weight: 600;
}

.fund-mix-bar {
  display: flex;
  gap: 3px;
  height: 8px;
  margin-top: 8px;
  overflow: hidden;
  background: #eef4f0;
  border-radius: 999px;
}

.fund-mix-seg {
  height: 100%;
  border-radius: 999px;
}

.fund-mix-seg--contribution,
.fund-mix-dot--contribution {
  background: #1e8a44;
}

.fund-mix-seg--deposit,
.fund-mix-dot--deposit {
  background: #8fd3a6;
}

.fund-mix-legend {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.fund-mix-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #5f6f66;
  font-size: 13px;

  strong {
    margin-left: auto;
    color: #16352a;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
}

.fund-mix-dot {
  width: 9px;
  height: 9px;
  min-width: 9px;
  border-radius: 50%;
}

// --- Responsive ------------------------------------------------------------------------

@media (max-width: 1180px) {
  .dash-grid,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .dash-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash-stat:nth-child(odd) {
    padding-left: 0;
    border-left: none;
  }

  .dash-stat:nth-child(n + 3) {
    border-top: 1px solid #eaf0ec;
  }
}

@media (max-width: 720px) {
  // Phone: the four stats stay a 2x2 grid (from the 1180px rule above) instead
  // of stacking into one tall column - the figures shrink to fit half a row.
  .dash-overview {
    padding: 18px 16px 2px;
  }

  .headline-value {
    font-size: 36px;
  }

  .headline-value span {
    font-size: 14px;
  }

  .dash-stats {
    margin-top: 16px;
  }

  .dash-stat {
    padding: 14px 0 14px 14px;
  }

  .dash-stat:nth-child(odd) {
    padding-right: 12px;
    padding-left: 0;
  }

  .stat-head {
    gap: 6px;
    font-size: 12px;
    line-height: 1.3;
  }

  .stat-head .q-icon {
    font-size: 16px;
  }

  .stat-value {
    margin-top: 6px;
    font-size: 22px;
  }

  .stat-value span {
    font-size: 12px;
  }

  .co2-metrics {
    grid-template-columns: 1fr;
  }

  .co2-total {
    text-align: left;
  }
}

// Below this the status card's column is too narrow to hold the donut and the
// list side by side, so the donut moves above the list.
@media (max-width: 560px) {
  .member-split {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .member-donut {
    justify-self: center;
    margin: 0 auto;
  }
}

// --- Per-village comparison ---------------------------------------------------

.village-section {
  margin-top: 28px;
}

// Nothing sits between this card's head and its plot, so the plot carries the
// gap the other panels get from their content's own top margin.
.village-bubble-card :deep(.vue-apexcharts) {
  margin-top: 14px;
}

// The tooltip is built as an HTML string inside ApexCharts, so it never picks up
// the scope attribute - reached through :deep() from the section instead.
.village-section :deep(.bubble-tip) {
  min-width: 200px;
  padding: 10px 12px;
}

.village-section :deep(.bubble-tip-name) {
  margin-bottom: 6px;
  color: #16352a;
  font-size: 13px;
  font-weight: 700;
}

.village-section :deep(.bubble-tip-row) {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  color: #6d7c74;
  font-size: 12.5px;
  line-height: 1.7;
}

.village-section :deep(.bubble-tip-row strong) {
  color: #2c3b33;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.village-table-card {
  margin-top: 18px;
}

.village-table {
  margin-top: 16px;
}

.village-table :deep(td),
.village-table :deep(th) {
  white-space: nowrap;
}

// Header reads as a tinted band with rounded ends instead of bare bold text.
.village-table :deep(thead th) {
  height: 40px;
  color: #6b7a72;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: #f3f8f4;
  border-bottom: 0;
}

.village-table :deep(thead th:first-child) {
  border-radius: 10px 0 0 10px;
}

.village-table :deep(thead th:last-child) {
  border-radius: 0 10px 10px 0;
}

.village-table :deep(tbody td) {
  height: 62px;
  padding-top: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eef3ef;
}

.village-row {
  transition: background 0.15s ease;

  &:hover td {
    background: #f8fbf8;
  }
}

.village-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.village-moo {
  display: grid;
  place-items: center;
  align-content: center;
  width: 42px;
  height: 42px;
  min-width: 42px;
  color: #0f7a40;
  background: linear-gradient(145deg, #e6f5ea, #d5ecdc);
  border-radius: 12px;
  line-height: 1;

  span {
    font-size: 10px;
    font-weight: 600;
    opacity: 0.8;
  }

  strong {
    margin-top: 1px;
    font-size: 17px;
    font-weight: 900;
  }
}

.village-name {
  color: #16352a;
  font-size: 14px;
  font-weight: 700;
}

.village-sub {
  margin-top: 2px;
  color: #8a958e;
  font-size: 12px;
  font-weight: 500;
}

.num {
  color: #2c3b33;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.num-unit {
  margin-left: 4px;
  color: #98a39d;
  font-size: 12px;
}

.num-strong {
  color: #16352a;
  font-weight: 800;
}

.num-co2 {
  color: #2f7d66;
}

.num-money {
  color: #0d7a44;
  font-weight: 800;
}

.num-zero {
  color: #b3bdb7;
}

.share-track {
  width: 96px;
  height: 5px;
  margin: 6px 0 0 auto;
  overflow: hidden;
  background: #edf3ef;
  border-radius: 999px;
}

.share-fill {
  height: 100%;
  background: linear-gradient(90deg, #5cc27d, #1e8a44);
  border-radius: inherit;
}

.village-sum-row td {
  height: 58px;
  color: #16352a;
  font-weight: 800;
  background: #f1f8f3;
  border-top: 2px solid #d4e9da;
  border-bottom: 0;

  &:first-child {
    border-radius: 0 0 0 12px;
  }

  &:last-child {
    border-radius: 0 0 12px 0;
  }
}

.village-sum-row .num {
  font-weight: 800;
}

// --- Village cards (phone only) ---

.village-cards {
  display: none;
}

.village-card {
  padding: 14px;
  background: #ffffff;
  border: 1px solid #e4ebe5;
  border-radius: 14px;
}

.village-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.village-card-head .village-cell {
  min-width: 0;
}

.village-card-members {
  white-space: nowrap;
}

.village-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 14px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4ede6;
}

.village-metric {
  min-width: 0;

  .num {
    display: block;
    overflow-wrap: anywhere;
  }
}

.village-metric-label {
  margin-bottom: 2px;
  color: #8a958e;
  font-size: 11.5px;
  font-weight: 600;
}

.share-track--card {
  width: 100%;
  margin: 6px 0 0;
}

.village-card--sum {
  background: #f1f8f3;
  border-color: #d4e9da;

  .num {
    font-weight: 800;
  }

  .village-card-grid {
    border-top-color: #d4e9da;
  }
}

@media (max-width: 720px) {
  .village-table {
    display: none;
  }

  .village-cards {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }
}

// The fund card leads the section, so the sales comparison below it needs the
// same separation the table below that already has.
.village-fund-card + .panel-card {
  margin-top: 18px;
}

// Nothing sits between this card's head and its plot, so the plot carries the
// gap the other panels get from their content's own top margin.
.village-fund-card :deep(.vue-apexcharts) {
  margin-top: 14px;
}

</style>
