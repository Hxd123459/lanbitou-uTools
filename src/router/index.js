import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LandingView from '../views/LandingView.vue'

const router = createRouter({
  // hash 模式不要用 vite 的 base './'，否则 file:// 下路由匹配失败
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/landing',
      name: 'landing',
      component: LandingView,
    },
  ],
})

export default router
