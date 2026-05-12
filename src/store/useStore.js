import { create } from 'zustand'

const useStore = create((set) => ({
  user: null,
  language: localStorage.getItem('tekabien_lang') || 'fr',
  sales: [],
  products: [],
  clients: [],
  expenses: [],

  setUser: (user) => set({ user }),

  setLanguage: (lang) => {
    localStorage.setItem('tekabien_lang', lang)
    set({ language: lang })
  },

  addSale: (sale) => set((state) => ({
    sales: [sale, ...state.sales]
  })),

  addProduct: (product) => set((state) => ({
    products: [...state.products, product]
  })),

  updateProduct: (id, updates) => set((state) => ({
    products: state.products.map(p =>
      p.id === id ? { ...p, ...updates } : p
    )
  })),

  addClient: (client) => set((state) => ({
    clients: [...state.clients, client]
  })),

  addExpense: (expense) => set((state) => ({
    expenses: [expense, ...state.expenses]
  })),
}))

export default useStore