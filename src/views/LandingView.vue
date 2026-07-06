<template>
  <div class="landing">
    <header class="landing-header">
      <BrandArea />
      <nav class="landing-nav" aria-label="页面导航">
        <a href="#features" class="landing-nav-link">功能</a>
        <a href="#workflow" class="landing-nav-link">工作流</a>
        <RouterLink to="/" class="landing-nav-link landing-nav-link--cta">
          进入应用
        </RouterLink>
      </nav>
    </header>

    <main>
      <section class="hero">
        <motion.div
          class="hero-content"
          :initial="presets.reveal.initial"
          :animate="presets.reveal.animate"
          :transition="presets.reveal.transition"
        >
          <p class="hero-badge">uTools 插件 · 本地优先</p>
          <h2 class="hero-title">
            灵感碎片，<span class="hero-title-accent">沉淀成文</span>
          </h2>
          <p class="hero-desc">
            烂笔头帮你随手记下每一闪念，用 AI 串联碎片、起草长文，
            让「好记性不如烂笔头」真正落地。
          </p>
          <div class="hero-actions">
            <RouterLink to="/" custom v-slot="{ navigate }">
              <AppButton class="btn btn-primary hero-btn" @click="navigate">
                立即体验
              </AppButton>
            </RouterLink>
            <a href="#features" class="hero-cta hero-cta--ghost">
              <AppButton class="btn btn-icon-text hero-btn">了解更多</AppButton>
            </a>
          </div>
        </motion.div>

        <motion.div
          class="hero-visual"
          :initial="{ opacity: 0, y: 16 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4, ease: 'easeOut', delay: 0.08 }"
          aria-hidden="true"
        >
          <div class="app-mock">
            <div class="app-mock-sidebar">
              <div class="mock-brand" />
              <div class="mock-nav mock-nav--active" />
              <div class="mock-nav" />
              <div class="mock-nav" />
              <div class="mock-nav" />
            </div>
            <div class="app-mock-main">
              <div class="mock-toolbar">
                <span class="mock-chip" />
                <span class="mock-chip mock-chip--muted" />
              </div>
              <div class="mock-cards">
                <div v-for="i in 3" :key="i" class="mock-card">
                  <div class="mock-line mock-line--title" />
                  <div class="mock-line" />
                  <div class="mock-line mock-line--short" />
                  <div class="mock-tags">
                    <span class="mock-tag" />
                    <span class="mock-tag" />
                  </div>
                </div>
              </div>
              <div class="mock-input">
                <span class="mock-input-text">写下此刻的想法…</span>
                <span class="mock-input-btn" />
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section id="features" class="features">
        <div class="section-head">
          <h3 class="section-title">为思考者设计</h3>
          <p class="section-desc">从捕获到沉淀，一条流畅的知识流水线</p>
        </div>

        <div class="feature-grid">
          <motion.article
            v-for="(feature, index) in features"
            :key="feature.title"
            class="feature-card"
            :initial="presets.reveal.initial"
            :while-in-view="presets.reveal.animate"
            :viewport="{ once: true, amount: 0.3 }"
            :transition="{ ...presets.reveal.transition, delay: index * 0.06 }"
          >
            <div class="feature-icon" aria-hidden="true" v-html="feature.icon" />
            <h4 class="feature-title">{{ feature.title }}</h4>
            <p class="feature-desc">{{ feature.desc }}</p>
          </motion.article>
        </div>
      </section>

      <section id="workflow" class="workflow">
        <div class="section-head">
          <h3 class="section-title">三步，从碎片到文章</h3>
          <p class="section-desc">不强迫你立刻整理，但随时能把零散想法拼起来</p>
        </div>

        <ol class="workflow-steps">
          <motion.li
            v-for="(step, index) in workflowSteps"
            :key="step.title"
            class="workflow-step"
            :initial="presets.reveal.initial"
            :while-in-view="presets.reveal.animate"
            :viewport="{ once: true, amount: 0.4 }"
            :transition="{ ...presets.reveal.transition, delay: index * 0.08 }"
          >
            <span class="workflow-num">{{ index + 1 }}</span>
            <div class="workflow-body">
              <h4 class="workflow-title">{{ step.title }}</h4>
              <p class="workflow-desc">{{ step.desc }}</p>
            </div>
          </motion.li>
        </ol>
      </section>

      <section class="cta-band">
        <motion.div
          class="cta-inner"
          :initial="presets.reveal.initial"
          :while-in-view="presets.reveal.animate"
          :viewport="{ once: true, amount: 0.5 }"
          :transition="presets.reveal.transition"
        >
          <h3 class="cta-title">好记性，不如烂笔头</h3>
          <p class="cta-desc">在 uTools 中搜索「烂笔头」，或点击下方按钮直接进入</p>
          <RouterLink to="/" custom v-slot="{ navigate }">
            <AppButton class="btn btn-primary cta-btn" @click="navigate">
              开始使用
            </AppButton>
          </RouterLink>
        </motion.div>
      </section>
    </main>

    <footer class="landing-footer">
      <BrandArea variant="sidebar" />
      <p class="footer-copy">© 烂笔头 · 数据存本地，思考归你</p>
    </footer>
  </div>
</template>

<script setup>
import { motion } from 'motion-v'
import BrandArea from '@/components/brand/BrandArea.vue'
import AppButton from '@/components/motion/AppButton.vue'
import { useMotionPresets } from '@/composables/useMotionPresets'

const { presets } = useMotionPresets()

const features = [
  {
    title: '碎片随手记',
    desc: '底部输入栏快速捕获文字与图片，不打断当前思路，灵感零摩擦入库。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h7v7H4z"/><path d="M15 4h5v5.5L16.5 14H13V8.5L15 4z"/><path d="M8 15.5h7v5.5H8z"/></svg>',
  },
  {
    title: '问 AI',
    desc: '基于你的笔记上下文对话，检索、归纳、追问，让 AI 真正读懂你的知识库。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c5 0 9 3.6 9 8s-4 8-9 8c-.9 0-1.8-.1-2.6-.3L3 21l1.8-4.2A7.7 7.7 0 0 1 3 11c0-4.4 4-8 9-8z"/><path d="M9.5 11h.01M14.5 11h.01"/></svg>',
  },
  {
    title: '沉淀成文',
    desc: '将碎片组装为结构化长文，Markdown 编辑、AI 辅助起草，从笔记到文章一站完成。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  },
  {
    title: '全局搜索',
    desc: '跨碎片与沉淀全文检索，标签筛选、日期范围，秒级定位任何一条记录。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  },
  {
    title: '本地存储',
    desc: 'uTools 插件形态，数据保存在本地，支持备份与恢复，隐私完全可控。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
  },
  {
    title: '批量智能',
    desc: '多选碎片批量打标签、AI 归类，整理大量笔记也能轻松应对。',
    icon: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="10" y="3" width="5" height="5" rx="1"/><rect x="17" y="3" width="4" height="5" rx="1"/><rect x="3" y="10" width="5" height="5" rx="1"/><rect x="10" y="10" width="5" height="5" rx="1"/><rect x="17" y="10" width="4" height="5" rx="1"/></svg>',
  },
]

const workflowSteps = [
  {
    title: '随手记',
    desc: '在任何场景下唤起 uTools，一句话、一张图，立刻变成碎片入库。',
  },
  {
    title: '问与搜',
    desc: '用全局搜索或 AI 对话，从海量碎片里找到关联与脉络。',
  },
  {
    title: '沉淀成文',
    desc: '挑选碎片插入沉淀笔记，AI 帮你起草框架，你只需润色定稿。',
  },
]
</script>

<style scoped>
.landing {
  min-height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-base);
  overflow-x: hidden;
}

.landing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 20px 24px;
}

.landing-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.landing-nav-link {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--color-secondary-text);
  text-decoration: none;
  border-radius: var(--btn-radius);
}

.landing-nav-link:hover {
  color: var(--color-text);
  background: rgba(24, 24, 27, 0.05);
}

.landing-nav-link--cta {
  color: var(--btn-primary-fg);
  background: var(--btn-primary-bg);
  box-shadow: var(--btn-primary-shadow);
}

.landing-nav-link--cta:hover {
  color: var(--btn-primary-fg);
  background: var(--btn-primary-bg-hover);
}

.hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  align-items: center;
  max-width: 1080px;
  margin: 0 auto;
  padding: 32px 24px 80px;
}

.hero-badge {
  display: inline-block;
  margin: 0 0 16px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.08);
  border-radius: 999px;
  letter-spacing: 0.3px;
}

.hero-title {
  margin: 0 0 16px;
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', var(--font-base);
  font-size: clamp(36px, 5vw, 52px);
  font-weight: 400;
  line-height: 1.15;
  letter-spacing: 1px;
}

.hero-title-accent {
  color: var(--color-accent);
}

.hero-desc {
  margin: 0 0 28px;
  max-width: 440px;
  font-size: 16px;
  line-height: 1.65;
  color: var(--color-secondary-text);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-cta {
  text-decoration: none;
}

.hero-btn {
  height: 38px !important;
  padding: 0 20px !important;
  font-size: 14px !important;
}

.hero-visual {
  display: flex;
  justify-content: center;
}

.app-mock {
  display: flex;
  width: 100%;
  max-width: 460px;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-float);
  overflow: hidden;
}

.app-mock-sidebar {
  flex: 0 0 72px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 8px;
  background: var(--shell-sidebar-bg);
  border-right: 1px solid var(--color-border);
}

.mock-brand {
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  border-radius: 8px;
  background: linear-gradient(135deg, #e4e4e7, #fafafa);
  border: 1px solid var(--color-border);
}

.mock-nav {
  height: 28px;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.04);
}

.mock-nav--active {
  background: rgba(24, 24, 27, 0.1);
}

.app-mock-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  min-width: 0;
}

.mock-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}

.mock-chip {
  width: 48px;
  height: 20px;
  border-radius: 999px;
  background: rgba(24, 24, 27, 0.08);
}

.mock-chip--muted {
  width: 32px;
  opacity: 0.5;
}

.mock-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.mock-card {
  padding: 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.mock-line {
  height: 6px;
  margin-bottom: 6px;
  border-radius: 3px;
  background: rgba(24, 24, 27, 0.08);
}

.mock-line--title {
  width: 60%;
  height: 8px;
  background: rgba(24, 24, 27, 0.14);
}

.mock-line--short {
  width: 40%;
  margin-bottom: 8px;
}

.mock-tags {
  display: flex;
  gap: 4px;
}

.mock-tag {
  width: 28px;
  height: 14px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.12);
}

.mock-input {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.mock-input-text {
  font-size: 11px;
  color: var(--color-secondary-text);
  opacity: 0.6;
}

.mock-input-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: var(--btn-primary-bg);
}

.features,
.workflow {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 24px 80px;
}

.section-head {
  margin-bottom: 32px;
  text-align: center;
}

.section-title {
  margin: 0 0 8px;
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', var(--font-base);
  font-size: 28px;
  font-weight: 400;
  letter-spacing: 1px;
}

.section-desc {
  margin: 0;
  font-size: 15px;
  color: var(--color-secondary-text);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.feature-card {
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-bottom: 14px;
  border-radius: 10px;
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.08);
}

.feature-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.feature-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-secondary-text);
}

.workflow-steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.workflow-step {
  display: flex;
  gap: 14px;
  padding: 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}

.workflow-num {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-accent);
  background: rgba(37, 99, 235, 0.1);
  border-radius: 10px;
}

.workflow-title {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
}

.workflow-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-secondary-text);
}

.cta-band {
  padding: 0 24px 80px;
}

.cta-inner {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 32px;
  text-align: center;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background: linear-gradient(160deg, #ffffff 0%, #f4f4f5 100%);
  box-shadow: var(--shadow-float);
}

.cta-title {
  margin: 0 0 10px;
  font-family: 'ZCOOL KuaiLe', 'PingFang SC', var(--font-base);
  font-size: 26px;
  font-weight: 400;
  letter-spacing: 1px;
}

.cta-desc {
  margin: 0 0 24px;
  font-size: 15px;
  color: var(--color-secondary-text);
}

.cta-link {
  text-decoration: none;
}

.cta-btn {
  height: 40px !important;
  padding: 0 24px !important;
  font-size: 14px !important;
}

.landing-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 24px 48px;
  border-top: 1px solid var(--color-border);
}

.footer-copy {
  margin: 0;
  font-size: 12px;
  color: var(--color-secondary-text);
}

@media (max-width: 900px) {
  .hero {
    grid-template-columns: 1fr;
    gap: 40px;
    padding-bottom: 60px;
  }

  .hero-visual {
    order: -1;
  }

  .feature-grid,
  .workflow-steps {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .landing-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .landing-nav {
    width: 100%;
    flex-wrap: wrap;
  }

  .hero {
    padding-top: 16px;
  }

  .hero-desc {
    font-size: 15px;
  }
}
</style>
