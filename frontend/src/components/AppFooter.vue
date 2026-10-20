<template>
  <footer class="site-footer">
    <div class="footer-container">
      <div class="footer-top">
        <div class="footer-brand">
          <img src="/icons/1.png" alt="โลโก้ธนาคารขยะ" class="footer-logo" />
          <div class="footer-title">
            <span>กองทุนธนาคารขยะเพื่อสนับสนุน</span>
            <span>ฌาปนกิจสงเคราะห์</span>
            <span>เทศบาลตำบลสามง่ามพัฒนา</span>
          </div>
        </div>

        <div class="footer-partners" aria-label="หน่วยงานที่เกี่ยวข้อง">
          <a
            href="https://www.chandra.ac.th/"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-partner-link"
            aria-label="มหาวิทยาลัยราชภัฏจันทรเกษม (เปิดในแท็บใหม่)"
          >
            <img
              src="/icons/chandrakasem.png"
              alt="มหาวิทยาลัยราชภัฏจันทรเกษม"
              class="footer-partner-logo"
            />
          </a>
          <a
            href="https://www.informatics.buu.ac.th/"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-partner-link"
            aria-label="คณะวิทยาการสารสนเทศ มหาวิทยาลัยบูรพา (เปิดในแท็บใหม่)"
          >
            <img src="/icons/buulogo.png" alt="มหาวิทยาลัยบูรพา" class="footer-partner-logo" />
          </a>
          <a
            href="https://www.samngampattana.go.th/home"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-partner-link"
            aria-label="เทศบาลตำบลสามง่ามพัฒนา (เปิดในแท็บใหม่)"
          >
            <img
              src="/icons/สามง่าม.png"
              alt="เทศบาลตำบลสามง่ามพัฒนา"
              class="footer-partner-logo"
            />
          </a>
        </div>
      </div>

      <div class="footer-credits">
        <section class="footer-prepared">
          <div class="footer-label">Prepared by</div>
          <div class="footer-credits-title">Research Team:</div>
          <ul class="footer-names">
            <li>Asst.Prof. Phairoj Samutrak, Ph.D.,</li>
            <li>Asst.Prof. Chaisiri Sanitphonklang, Ph.D., and</li>
            <li>Asst.Prof. Sirithip Wasinrat, Ph.D.</li>
          </ul>
          <p class="footer-collab">
            in collaboration with the Research and Development Institute,<br />
            Chandrakasem Rajabhat University.
          </p>
        </section>

        <section class="footer-devteam">
          <div class="footer-label">Software Development by</div>
          <!-- The PNG is mostly empty canvas: the frame shows only the logo itself. -->
          <div class="footer-dev-logo">
            <img src="/icons/kimimetoo.png" alt="KIMIMETO TEAM" />
          </div>
        </section>
      </div>

      <div class="footer-bottom">
        <span>
          © {{ year }} กองทุนธนาคารขยะเพื่อสนับสนุนฌาปนกิจสงเคราะห์
          <span class="footer-nowrap">เทศบาลตำบลสามง่ามพัฒนา</span>
        </span>
        <span class="footer-rights">
          สงวนลิขสิทธิ์
          <span class="footer-version">v{{ appVersion }}</span>
        </span>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
// package.json "version", passed in by quasar.config.ts (build.env).
const appVersion = process.env.APP_VERSION;

const year = new Date().getFullYear();
</script>

<style scoped>
.site-footer {
  position: relative;
  z-index: 10;
  color: white;
  background: linear-gradient(135deg, #06492d, #087f49);
}

.footer-container {
  width: min(1240px, calc(100% - 80px));
  margin: 0 auto;
}

/* --- Brand + partner logos ------------------------------------------------ */
.footer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 36px 0 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.footer-logo {
  flex-shrink: 0;
  width: 54px;
  height: 54px;
  object-fit: contain;
  background: white;
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(0, 35, 19, 0.2);
}

/* Desktop: two lines - the fund, then the municipality (kept whole). */
.footer-title {
  min-width: 0;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.4;
}

.footer-title span:nth-child(3) {
  display: block;
  white-space: nowrap;
}

.footer-partners {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 18px;
}

.footer-partner-link {
  display: block;
  border-radius: 8px;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease;
}

.footer-partner-link:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.footer-partner-link:focus-visible {
  outline: 2px solid #b9ecc7;
  outline-offset: 4px;
}

/* All three are round seals: one square size for each. */
.footer-partner-logo {
  display: block;
  width: 84px;
  height: 84px;
  object-fit: contain;
}

/* --- Credits: research team | software team ------------------------------- */
.footer-credits {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 400px);
  gap: 32px;
  padding: 30px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.footer-label {
  margin-bottom: 14px;
  color: #b9ecc7;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.footer-credits-title {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 800;
}

.footer-names {
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
  font-size: 15px;
  line-height: 1.85;
}

.footer-collab {
  max-width: 560px;
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  line-height: 1.6;
}

.footer-devteam {
  padding-left: 32px;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

/* Crops kimimetoo.png (1536x1024) to its logo (1316x378 at 114,298). Plain on
   the green - no light box behind it. */
.footer-dev-logo {
  width: 260px;
  max-width: 100%;
  aspect-ratio: 1316 / 378;
  overflow: hidden;
}

.footer-dev-logo img {
  display: block;
  width: calc(100% * 1536 / 1316);
  max-width: none;
  margin-top: calc(-100% * 298 / 1316);
  margin-left: calc(-100% * 114 / 1316);
}

/* --- Copyright ------------------------------------------------------------ */
.footer-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 22px 0 26px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  line-height: 1.6;
}

.footer-nowrap,
.footer-rights {
  white-space: nowrap;
}

.footer-version {
  margin-left: 10px;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 900px) {
  .footer-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-credits {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 0;
    border-bottom: 0;
  }

  .footer-prepared,
  .footer-devteam {
    padding: 26px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  }

  .footer-devteam {
    border-left: 0;
  }

  .footer-bottom {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 640px) {
  .footer-container {
    width: calc(100% - 40px);
  }

  .footer-top {
    gap: 22px;
    padding: 32px 0 24px;
  }

  .footer-logo {
    width: 48px;
    height: 48px;
  }

  /* Phone: three lines - fund / ฌาปนกิจสงเคราะห์ / municipality. */
  .footer-title {
    font-size: 16px;
  }

  .footer-title span {
    display: block;
  }

  .footer-partners {
    gap: 14px;
  }

  .footer-partner-logo {
    width: 64px;
    height: 64px;
  }

  .footer-label {
    font-size: 12px;
  }

  .footer-names {
    line-height: 1.75;
  }

  .footer-dev-logo {
    width: 230px;
  }
}
</style>
