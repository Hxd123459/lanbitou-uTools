<template>
  <div v-if="items.length" class="tiptap-slash-menu" role="listbox">
    <button
      v-for="(item, index) in items"
      :key="item.title"
      type="button"
      class="tiptap-slash-menu__item"
      :class="{ 'tiptap-slash-menu__item--active': index === selectedIndex }"
      role="option"
      :aria-selected="index === selectedIndex"
      @mousedown.prevent="selectItem(index)"
    >
      <span class="tiptap-slash-menu__icon" aria-hidden="true">
        <component :is="iconMap[item.icon]" />
      </span>
      <span class="tiptap-slash-menu__content">
        <span class="tiptap-slash-menu__title">{{ item.title }}</span>
        <span class="tiptap-slash-menu__description">{{ item.description }}</span>
      </span>
    </button>
  </div>
</template>

<script setup>
import { h, ref, watch } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  command: {
    type: Function,
    required: true,
  },
})

const selectedIndex = ref(0)

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  },
)

const strokeIcon = (paths) =>
  h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 18,
      height: 18,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
    },
    paths.map((d) => h('path', { d })),
  )

const iconMap = {
  paragraph: strokeIcon(['M4 6h16', 'M4 12h10', 'M4 18h14']),
  h1: strokeIcon(['M6 4v16', 'M18 4v16', 'M6 12h12', 'M10 8h8', 'M10 16h8']),
  h2: strokeIcon(['M6 4v16', 'M18 4v16', 'M6 12h12', 'M11 8h6', 'M11 16h6']),
  h3: strokeIcon(['M6 4v16', 'M18 4v16', 'M6 12h12', 'M12 8h4', 'M12 16h4']),
  ol: strokeIcon(['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01']),
  ul: () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: 18,
        height: 18,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      },
      [
        h('circle', { cx: 5, cy: 6, r: 1.5, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 5, cy: 12, r: 1.5, fill: 'currentColor', stroke: 'none' }),
        h('circle', { cx: 5, cy: 18, r: 1.5, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M9 6h10' }),
        h('path', { d: 'M9 12h10' }),
        h('path', { d: 'M9 18h10' }),
      ],
    ),
  task: () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: 18,
        height: 18,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
      },
      [
        h('rect', { x: 4, y: 5, width: 14, height: 14, rx: 2 }),
        h('path', { d: 'M8 12l2.5 2.5L16 9' }),
      ],
    ),
  quote: () =>
    h(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: 18,
        height: 18,
        fill: 'currentColor',
        stroke: 'none',
      },
      [h('path', { d: 'M7 7h4v4H7V7zm6 0h4v4h-4V7zM5 11c0 2.2 1.8 4 4 4v2C5.6 17 3 14.4 3 11h2zm10 0c0 2.2 1.8 4 4 4v2c-3.4 0-6-2.6-6-6h2z' })],
    ),
  code: strokeIcon(['M8 8L4 12l4 4', 'M16 8l4 4-4 4']),
}

const selectItem = (index) => {
  const item = props.items[index]
  if (item) props.command(item)
}

const onKeyDown = ({ event }) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value =
      (selectedIndex.value + props.items.length - 1) % props.items.length
    return true
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = (selectedIndex.value + 1) % props.items.length
    return true
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    selectItem(selectedIndex.value)
    return true
  }

  return false
}

defineExpose({ onKeyDown })
</script>
