<template>
  <q-page class="muni-page">
    <div class="muni-shell">
      <section class="muni-hero">
        <div class="hero-leaf hero-leaf-one"></div>
        <div class="hero-leaf hero-leaf-two"></div>

        <div class="hero-row">
          <div class="hero-icon"><q-icon name="backup" /></div>
          <div class="hero-copy"><h1>สำรองและกู้คืนข้อมูล</h1></div>
        </div>
      </section>

      <q-card flat class="panel-card q-mt-lg">
        <q-card-section class="text-center q-pa-xl">
          <q-icon name="cloud_off" size="64px" color="grey-7" class="q-mb-md" />
          <div class="text-h6 text-weight-bold">ปิดใช้งานชั่วคราว</div>
          <p class="text-body1 text-grey-8 q-mx-auto notice-copy">
            ระบบเปลี่ยนมาใช้ PostgreSQL บน Supabase แล้ว จึงไม่รองรับการดาวน์โหลดหรืออัปโหลดไฟล์ .db
            ผู้ดูแลระบบต้องสำรองและกู้คืนข้อมูลผ่านเครื่องมือที่ Supabase จัดการให้
          </p>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<style lang="scss" scoped>
@use './theme' as *;
.notice-copy { max-width: 720px; }
</style>
