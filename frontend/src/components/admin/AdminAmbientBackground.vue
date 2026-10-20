<template>
  <div class="admin-ambient-bg" aria-hidden="true">
    <!-- ก้อนที่ 1 (มุมบนขวา): โทนสี emerald-300/15 -->
    <div class="ambient-blob ambient-blob--top-right"></div>

    <!-- ก้อนที่ 2 (ฝั่งซ้ายกลางจอ): โทนสี teal-300/12 -->
    <div class="ambient-blob ambient-blob--mid-left"></div>

    <!-- ก้อนที่ 3 (ตรงกลาง): โทนสี green-200/10 -->
    <div class="ambient-blob ambient-blob--center"></div>
  </div>
</template>

<style scoped lang="scss">
.admin-ambient-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  overflow: hidden;
  background: transparent;
}

.ambient-blob {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  will-change: transform;
  transform: translateZ(0);
}

/* ก้อนที่ 1 (มุมบนขวา): โทน emerald-300/15 */
.ambient-blob--top-right {
  top: -6rem;
  right: -6rem;
  width: 26rem;
  height: 26rem;
  background: radial-gradient(
    circle,
    rgba(110, 231, 183, 0.15) 0%,
    rgba(110, 231, 183, 0.08) 60%,
    transparent 100%
  );
  animation: blobMove1 7s ease-in-out infinite;
}

/* ก้อนที่ 2 (ฝั่งซ้ายกลางจอ): โทน teal-300/12 */
.ambient-blob--mid-left {
  top: 30%;
  left: -8rem;
  width: 24rem;
  height: 24rem;
  background: radial-gradient(
    circle,
    rgba(94, 234, 212, 0.12) 0%,
    rgba(94, 234, 212, 0.06) 60%,
    transparent 100%
  );
  animation: blobMove2 8s ease-in-out infinite;
}

/* ก้อนที่ 3 (ตรงกลาง): โทน green-200/10 */
.ambient-blob--center {
  top: 45%;
  right: 12%;
  width: 18rem;
  height: 18rem;
  background: radial-gradient(
    circle,
    rgba(187, 247, 208, 0.1) 0%,
    rgba(187, 247, 208, 0.05) 65%,
    transparent 100%
  );
  animation: blobMove1 6.5s ease-in-out infinite reverse;
}

@keyframes blobMove1 {
  0% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
  }
  33% {
    transform: translate(80px, -60px) scale(1.2) rotate(45deg);
  }
  66% {
    transform: translate(-40px, 70px) scale(0.85) rotate(-30deg);
  }
  100% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
  }
}

@keyframes blobMove2 {
  0% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
  }
  33% {
    transform: translate(-90px, 60px) scale(0.9) rotate(-45deg);
  }
  66% {
    transform: translate(60px, -50px) scale(1.25) rotate(60deg);
  }
  100% {
    transform: translate(0px, 0px) scale(1) rotate(0deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ambient-blob {
    animation: none !important;
  }
}
</style>
