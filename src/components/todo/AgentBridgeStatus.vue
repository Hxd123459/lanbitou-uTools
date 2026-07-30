<template>
  <div
    v-if="visible"
    class="agent-bridge-status"
    :class="{
      'is-online': online,
      'is-offline': !online && !checking && !starting,
      'is-busy': checking || starting,
    }"
  >
    <button
      type="button"
      class="agent-bridge-status-main"
      :disabled="starting"
      :title="tooltip"
      @click="onMainClick"
    >
      <span class="agent-bridge-status-dot" aria-hidden="true" />
      <span class="agent-bridge-status-label">{{ label }}</span>
    </button>
    <button
      v-if="!online && !starting"
      type="button"
      class="agent-bridge-status-action"
      title="启动最小化常驻窗（仅一个，请勿关闭）"
      @click="startBridge"
    >
      启动
    </button>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getAgentBridgeStatus,
  isAgentBridgeAvailable,
  openAgentBridgeFolder,
  startAgentBridgeResident,
} from '../../api/agentBridge'

const props = defineProps({
  /** 轮询间隔 ms */
  pollMs: {
    type: Number,
    default: 5000,
  },
})

const emit = defineEmits(['change', 'toast'])

const visible = computed(() => isAgentBridgeAvailable())
const online = ref(false)
const checking = ref(false)
const starting = ref(false)
const port = ref(39281)
const launcher = ref('')

const label = computed(() => {
  if (starting.value) return '启动中…'
  if (checking.value && !online.value) return '检测中…'
  if (online.value) return `桥 :${port.value}`
  return '桥离线'
})

const tooltip = computed(() => {
  if (online.value) {
    const tip = `Agent 桥在线 · 127.0.0.1:${port.value}（任务栏有一个最小化窗口，勿关）`
    return launcher.value ? `${tip} · ${launcher.value}` : tip
  }
  return 'Agent 桥未运行。点「启动」会打开一个最小化常驻窗；已在线不会再开第二个'
})

let timer = null
let alive = true

async function refresh() {
  if (!visible.value || starting.value) return
  checking.value = true
  try {
    const status = await getAgentBridgeStatus()
    if (!alive) return
    online.value = Boolean(status.online)
    port.value = Number(status.port) || 39281
    launcher.value = String(status.launcher || '')
    emit('change', status)
  } finally {
    if (alive) checking.value = false
  }
}

async function startBridge() {
  if (starting.value || online.value) return
  starting.value = true
  try {
    const result = await startAgentBridgeResident()
    await refresh()
    if (online.value) {
      emit(
        'toast',
        result?.already
          ? 'Agent 桥已在运行（未重复开窗）'
          : 'Agent 桥已启动：任务栏有一个最小化窗口，请勿关闭',
      )
    } else {
      emit('toast', '启动未成功，请从任务栏查看「烂笔头 Agent 桥」窗口报错')
      openAgentBridgeFolder()
    }
  } catch (error) {
    emit('toast', error?.message || '启动 Agent 桥失败')
    openAgentBridgeFolder()
  } finally {
    starting.value = false
  }
}

function onMainClick() {
  if (online.value) {
    void refresh()
    return
  }
  void startBridge()
}

onMounted(() => {
  void refresh()
  timer = window.setInterval(() => {
    void refresh()
  }, Math.max(2000, Number(props.pollMs) || 5000))
})

onBeforeUnmount(() => {
  alive = false
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.agent-bridge-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 2px;
  border-radius: 8px;
  background: rgba(100, 116, 139, 0.1);
}

.agent-bridge-status-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.agent-bridge-status-main:disabled {
  cursor: wait;
  opacity: 0.8;
}

.agent-bridge-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  flex: 0 0 auto;
}

.agent-bridge-status.is-online {
  background: rgba(22, 163, 74, 0.1);
}

.agent-bridge-status.is-online .agent-bridge-status-main {
  color: #15803d;
}

.agent-bridge-status.is-online .agent-bridge-status-dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.agent-bridge-status.is-offline {
  background: rgba(185, 28, 28, 0.08);
}

.agent-bridge-status.is-offline .agent-bridge-status-main {
  color: #b91c1c;
}

.agent-bridge-status.is-offline .agent-bridge-status-dot {
  background: #ef4444;
}

.agent-bridge-status.is-busy .agent-bridge-status-dot {
  background: #f59e0b;
  animation: agent-bridge-pulse 1s ease-in-out infinite;
}

.agent-bridge-status-action {
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: rgba(24, 24, 27, 0.08);
  color: var(--color-primary, #18181b);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.agent-bridge-status-action:hover {
  background: rgba(24, 24, 27, 0.14);
}

@keyframes agent-bridge-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
