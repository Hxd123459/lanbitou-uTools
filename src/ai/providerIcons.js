import utools from '../assets/icons/providers/utools.png'
import zhipu from '../assets/icons/providers/zhipu.png'
import deepseek from '../assets/icons/providers/deepseek.png'
import qwen from '../assets/icons/providers/qwen.svg'
import moonshot from '../assets/icons/providers/moonshot.png'
import openai from '../assets/icons/providers/openai.png'
import anthropic from '../assets/icons/providers/anthropic.png'
import custom from '../assets/icons/providers/custom.png'

export const PROVIDER_ICONS = {
  utools,
  zhipu,
  deepseek,
  qwen,
  moonshot,
  openai,
  anthropic,
  custom,
}

export function getProviderIcon(providerId) {
  return PROVIDER_ICONS[providerId] || ''
}
